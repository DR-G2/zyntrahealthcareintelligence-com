-- PIE v1.0 P1.2: exam readiness
-- Purpose: store exam-specific readiness inference as an output of the
-- candidate state + exam environment.
-- Readiness is NOT a latent candidate state and is NOT a fixed weighted score.

CREATE TABLE IF NOT EXISTS public.pie_exam_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  candidate_state_id UUID
    REFERENCES public.pie_candidate_state(id) ON DELETE SET NULL,

  exam_environment_id UUID NOT NULL
    REFERENCES public.pie_exam_environment(id) ON DELETE RESTRICT,

  adapter_snapshot_id UUID
    REFERENCES public.pie_exam_adapter_snapshot(id) ON DELETE SET NULL,

  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  target_probability NUMERIC
    CHECK (
      target_probability IS NULL
      OR (target_probability >= 0 AND target_probability <= 1)
    ),

  lower_bound NUMERIC
    CHECK (
      lower_bound IS NULL
      OR (lower_bound >= 0 AND lower_bound <= 1)
    ),

  upper_bound NUMERIC
    CHECK (
      upper_bound IS NULL
      OR (upper_bound >= 0 AND upper_bound <= 1)
    ),

  uncertainty_measure NUMERIC
    CHECK (
      uncertainty_measure IS NULL OR uncertainty_measure >= 0
    ),

  evidence_count INTEGER NOT NULL DEFAULT 0
    CHECK (evidence_count >= 0),

  evidence_quality NUMERIC
    CHECK (
      evidence_quality IS NULL
      OR (evidence_quality >= 0 AND evidence_quality <= 1)
    ),

  identification_status TEXT NOT NULL DEFAULT 'UNRESOLVED'
    CHECK (
      identification_status IN (
        'UNRESOLVED',
        'PROVISIONALLY_IDENTIFIED',
        'IDENTIFIED_FOR_DECISION'
      )
    ),

  readiness_status TEXT NOT NULL DEFAULT 'INSUFFICIENT_EVIDENCE'
    CHECK (
      readiness_status IN (
        'INSUFFICIENT_EVIDENCE',
        'ESTIMATE_AVAILABLE',
        'DECISION_STABLE'
      )
    ),

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_exam_readiness IS
  'Exam-specific readiness inference. Readiness is a conditional output of core candidate state and a versioned exam environment, not a permanent candidate trait.';

COMMENT ON COLUMN public.pie_exam_readiness.target_probability IS
  'Estimated probability of the configured exam target under this exam environment. It is not a generic readiness percentage.';

COMMENT ON COLUMN public.pie_exam_readiness.uncertainty_measure IS
  'Uncertainty attached to the readiness estimate. A readiness estimate without uncertainty is incomplete.';

COMMENT ON COLUMN public.pie_exam_readiness.evidence_count IS
  'Supporting evidence count. It is descriptive and must not become a hard-coded readiness threshold.';

COMMENT ON COLUMN public.pie_exam_readiness.readiness_status IS
  'Describes whether the estimate is unavailable, usable, or stable enough for the configured decision.';

CREATE INDEX IF NOT EXISTS pie_exam_readiness_user_time_idx
  ON public.pie_exam_readiness (user_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS pie_exam_readiness_exam_idx
  ON public.pie_exam_readiness (exam_environment_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS pie_exam_readiness_candidate_state_idx
  ON public.pie_exam_readiness (candidate_state_id);

CREATE INDEX IF NOT EXISTS pie_exam_readiness_model_idx
  ON public.pie_exam_readiness (model_version);

ALTER TABLE public.pie_exam_readiness ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_exam_readiness_owner_select ON public.pie_exam_readiness;
CREATE POLICY pie_exam_readiness_owner_select
  ON public.pie_exam_readiness
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_exam_readiness_service_select ON public.pie_exam_readiness;
CREATE POLICY pie_exam_readiness_service_select
  ON public.pie_exam_readiness
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_exam_readiness_service_insert ON public.pie_exam_readiness;
CREATE POLICY pie_exam_readiness_service_insert
  ON public.pie_exam_readiness
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_exam_readiness_service_update ON public.pie_exam_readiness;
CREATE POLICY pie_exam_readiness_service_update
  ON public.pie_exam_readiness
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_exam_readiness_service_delete ON public.pie_exam_readiness;
CREATE POLICY pie_exam_readiness_service_delete
  ON public.pie_exam_readiness
  FOR DELETE
  TO service_role
  USING (true);

-- P1.2 deliberately contains no readiness formula, fixed weights, pass
-- threshold, or hard-coded evidence-count rule.
-- The validated inference engine will populate this table in a later phase.
