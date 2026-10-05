-- PIE P3: inference-run provenance and atomic state persistence.
-- The inference engine remains application-owned. SQL stores snapshots and provenance only.

CREATE TABLE IF NOT EXISTS public.pie_inference_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  model_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  observation_count INTEGER NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
  state_sequence BIGINT,
  error_code TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS pie_inference_run_user_time_idx
  ON public.pie_inference_run (user_id, started_at DESC);

ALTER TABLE public.pie_inference_run ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_inference_run_owner_select ON public.pie_inference_run;
CREATE POLICY pie_inference_run_owner_select
  ON public.pie_inference_run
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pie_inference_run_service_all ON public.pie_inference_run;
CREATE POLICY pie_inference_run_service_all
  ON public.pie_inference_run
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.pie_persist_state_snapshot(
  p_user_id UUID,
  p_model_version TEXT,
  p_state JSONB,
  p_uncertainty JSONB,
  p_observation_count INTEGER
)
RETURNS TABLE (
  state_id UUID,
  state_sequence BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence BIGINT;
  v_state_id UUID;
  v_key TEXT;
  v_dimension JSONB;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));

  SELECT COALESCE(MAX(s.state_sequence), -1) + 1
    INTO v_sequence
  FROM public.pie_candidate_state s
  WHERE s.user_id = p_user_id;

  INSERT INTO public.pie_candidate_state (
    user_id,
    state_timestamp,
    state_sequence,
    capability_estimate,
    decision_estimate,
    timing_estimate,
    calibration_estimate,
    sustained_performance_estimate,
    learning_estimate,
    identification_status,
    evidence_level,
    data_quality,
    model_version,
    observation_count
  )
  VALUES (
    p_user_id,
    COALESCE((p_state->>'timestamp')::timestamptz, now()),
    v_sequence,
    (p_state->'capability'->>'estimate')::numeric,
    (p_state->'decision'->>'estimate')::numeric,
    (p_state->'timing'->>'estimate')::numeric,
    (p_state->'calibration'->>'estimate')::numeric,
    (p_state->'sustainedPerformance'->>'estimate')::numeric,
    (p_state->'learning'->>'estimate')::numeric,
    COALESCE(p_state->>'identificationStatus','UNRESOLVED'),
    COALESCE(p_state->>'evidenceLevel','INSUFFICIENT'),
    (p_state->>'dataQuality')::numeric,
    p_model_version,
    p_observation_count
  )
  RETURNING id INTO v_state_id;

  FOR v_key IN SELECT jsonb_object_keys(p_uncertainty)
  LOOP
    v_dimension := p_uncertainty -> v_key;
    INSERT INTO public.pie_state_uncertainty (
      candidate_state_id,
      state_dimension,
      estimate,
      lower_bound,
      upper_bound,
      variance,
      confidence_level,
      evidence_count,
      evidence_quality
    )
    VALUES (
      v_state_id,
      upper(v_key),
      (v_dimension->>'estimate')::numeric,
      (v_dimension->>'lower')::numeric,
      (v_dimension->>'upper')::numeric,
      (v_dimension->>'variance')::numeric,
      (v_dimension->>'confidenceLevel')::numeric,
      (v_dimension->>'evidenceCount')::integer,
      (v_dimension->>'evidenceQuality')::numeric
    );
  END LOOP;

  RETURN QUERY SELECT v_state_id, v_sequence;
END;
$$;

REVOKE ALL ON FUNCTION public.pie_persist_state_snapshot(UUID,TEXT,JSONB,JSONB,INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pie_persist_state_snapshot(UUID,TEXT,JSONB,JSONB,INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.pie_persist_state_snapshot(UUID,TEXT,JSONB,JSONB,INTEGER) TO service_role;

COMMENT ON FUNCTION public.pie_persist_state_snapshot IS
  'Atomic service-role persistence boundary for P3 inference snapshots. It does not calculate candidate intelligence.';
