-- P4: keep AMC readiness exam-conditional without inventing a fixed-weight composite.
-- No candidate pass probability or scalar readiness index is exposed until a validated
-- calibration model is implemented and independently approved.

ALTER TABLE public.amc_adapter_evaluation
  ADD COLUMN IF NOT EXISTS readiness_index NUMERIC,
  ADD COLUMN IF NOT EXISTS readiness_index_lower NUMERIC,
  ADD COLUMN IF NOT EXISTS readiness_index_upper NUMERIC,
  ADD COLUMN IF NOT EXISTS readiness_basis TEXT,
  ADD COLUMN IF NOT EXISTS model_version TEXT,
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.rebuild_my_amc_readiness(p_exam_mode text DEFAULT 'MCQ')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_plugin record;
  v_environment record;
  v_dimension_count integer := 0;
  v_min_evidence integer := 0;
  v_max_uncertainty numeric := 1;
  v_required_dimensions text[] := ARRAY[
    'capability','decision','timing','calibration','sustained_performance','learning'
  ];
  v_model_version text := 'amc-readiness-unvalidated-v1.1';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_exam_mode NOT IN ('MCQ','CLINICAL') THEN
    RAISE EXCEPTION 'invalid exam mode' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_plugin
  FROM public.amc_plugin_version
  WHERE plugin_code = 'AMC' AND plugin_version = '1.0.0'
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMC plugin version unavailable' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_environment
  FROM public.amc_exam_environment_v1
  WHERE plugin_version_id = v_plugin.id AND exam_mode = p_exam_mode
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMC exam environment unavailable' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*), coalesce(min(s.evidence_count), 0), coalesce(max(s.uncertainty), 1)
  INTO v_dimension_count, v_min_evidence, v_max_uncertainty
  FROM pie.inference_state s
  WHERE s.user_id = v_user
    AND s.dimension = ANY(v_required_dimensions);

  -- There is deliberately no average of PIE dimensions here. The dimensions do not
  -- yet have a validated AMC-specific mapping or calibrated combination function.
  INSERT INTO public.amc_adapter_evaluation (
    user_id, plugin_version_id, environment_id, target_probability,
    lower_bound, upper_bound, uncertainty_measure, evidence_count, evidence_quality,
    identification_status, readiness_status, readiness_index, readiness_index_lower,
    readiness_index_upper, readiness_basis, model_version, state_snapshot,
    adapter_context, provenance
  )
  VALUES (
    v_user, v_plugin.id, v_environment.id, NULL,
    NULL, NULL, v_max_uncertainty, v_min_evidence,
    greatest(0, least(1, 1 - v_max_uncertainty)),
    'UNRESOLVED', 'INSUFFICIENT_EVIDENCE', NULL, NULL, NULL,
    'No calibrated AMC readiness formula is active; composite index withheld.',
    v_model_version,
    jsonb_build_object(
      'dimension_count', v_dimension_count,
      'required_dimensions', to_jsonb(v_required_dimensions),
      'minimum_dimension_evidence', v_min_evidence
    ),
    jsonb_build_object(
      'environment_code', v_environment.environment_code,
      'environment_version', v_environment.environment_version,
      'exam_mode', p_exam_mode,
      'pass_probability_calibrated', false
    ),
    jsonb_build_object(
      'probability_claim', false,
      'composite_index_claim', false,
      'reason', 'independent_calibration_not_complete'
    )
  );

  RETURN jsonb_build_object(
    'plugin', 'AMC',
    'pluginVersion', v_plugin.plugin_version,
    'examMode', p_exam_mode,
    'environmentCode', v_environment.environment_code,
    'readiness', jsonb_build_object(
      'probability', NULL,
      'status', 'INSUFFICIENT_EVIDENCE'
    ),
    'dimensionCount', v_dimension_count,
    'probabilityStatus', 'NOT_CALIBRATED',
    'modelVersion', v_model_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_amc_readiness(p_exam_mode text DEFAULT 'MCQ')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_exam_mode NOT IN ('MCQ','CLINICAL') THEN
    RAISE EXCEPTION 'invalid exam mode' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'plugin', 'AMC',
    'pluginVersion', p.plugin_version,
    'examMode', e.exam_mode,
    'environmentCode', e.environment_code,
    'readiness', jsonb_build_object(
      'probability', NULL,
      'status', 'INSUFFICIENT_EVIDENCE'
    ),
    'dimensionCount', coalesce((a.state_snapshot->>'dimension_count')::integer, 0),
    'probabilityStatus', 'NOT_CALIBRATED',
    'modelVersion', coalesce(a.model_version, 'amc-readiness-unvalidated-v1.1')
  )
  INTO v_result
  FROM public.amc_adapter_evaluation a
  JOIN public.amc_plugin_version p ON p.id = a.plugin_version_id
  JOIN public.amc_exam_environment_v1 e ON e.id = a.environment_id
  WHERE a.user_id = v_user AND e.exam_mode = p_exam_mode
  ORDER BY a.evaluated_at DESC
  LIMIT 1;

  RETURN coalesce(v_result, jsonb_build_object(
    'plugin', 'AMC',
    'pluginVersion', '1.0.0',
    'examMode', p_exam_mode,
    'environmentCode', NULL,
    'readiness', jsonb_build_object('probability', NULL, 'status', 'INSUFFICIENT_EVIDENCE'),
    'dimensionCount', 0,
    'probabilityStatus', 'NOT_CALIBRATED',
    'modelVersion', 'amc-readiness-unvalidated-v1.1'
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_my_amc_readiness(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_amc_readiness(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebuild_my_amc_readiness(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_amc_readiness(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.rebuild_my_amc_readiness(text) IS
'Stores an exam-conditional evidence snapshot but does not calculate an unvalidated weighted readiness index or pass probability.';
COMMENT ON FUNCTION public.get_my_amc_readiness(text) IS
'Candidate-safe AMC readiness DTO. Composite index and pass probability remain withheld until independent calibration is complete.';
