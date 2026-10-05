-- PIE v1.0 P0.3: candidate state and uncertainty
-- Purpose: persist the exam-neutral latent candidate state and its uncertainty.
-- This migration does not calculate state estimates. The inference engine owns the mathematics.

CREATE TABLE IF NOT EXISTS public.pie_candidate_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL,

  state_timestamp TIMESTAMPTZ NOT NULL,
  state_sequence BIGINT NOT NULL,

  capability_estimate NUMERIC,
  decision_estimate NUMERIC,
  timing_estimate NUMERIC,
  calibration_estimate NUMERIC,
  sustained_performance_estimate NUMERIC,
  learning_estimate NUMERIC,

  identification_status TEXT NOT NULL DEFAULT 'UNRESOLVED'
    CHECK (identification_status IN (
      'UNRESOLVED',
      'PROVISIONALLY_IDENTIFIED',
      'IDENTIFIED_FOR_DECISION'
    )),

  evidence_level TEXT NOT NULL DEFAULT 'INSUFFICIENT',

  data_quality NUMERIC
    CHECK (data_quality IS NULL OR (data_quality >= 0 AND data_quality <= 1)),

  model_version TEXT NOT NULL,

  observation_count INTEGER NOT NULL DEFAULT 0
    CHECK (observation_count >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_candidate_state_user_sequence_unique
    UNIQUE (user_id, state_sequence)
);

COMMENT ON TABLE public.pie_candidate_state IS
  'Exam-neutral PIE candidate state snapshot. Estimates are inference outputs, not raw observations and not a universal readiness score.';

COMMENT ON COLUMN public.pie_candidate_state.capability_estimate IS
  'K: capability state. Interpretation is model-dependent and must retain uncertainty.';

COMMENT ON COLUMN public.pie_candidate_state.decision_estimate IS
  'D: decision behaviour state. It must not be interpreted as a personality trait.';

COMMENT ON COLUMN public.pie_candidate_state.timing_estimate IS
  'T: timing state under observed task/environment conditions.';

COMMENT ON COLUMN public.pie_candidate_state.calibration_estimate IS
  'C: confidence/outcome calibration state. Missing confidence must not be treated as low calibration.';

COMMENT ON COLUMN public.pie_candidate_state.sustained_performance_estimate IS
  'F: sustained-performance state. Do not equate this field directly with fatigue.';

COMMENT ON COLUMN public.pie_candidate_state.learning_estimate IS
  'L: learning state/trajectory estimate. Improvement alone is not sufficient evidence of learning.';

COMMENT ON COLUMN public.pie_candidate_state.identification_status IS
  'State identifiability status. PIE may remain UNRESOLVED when competing explanations cannot be separated.';

COMMENT ON COLUMN public.pie_candidate_state.evidence_level IS
  'Qualitative evidence level. It must not be treated as a fixed question-count threshold.';

COMMENT ON COLUMN public.pie_candidate_state.data_quality IS
  'Overall data-quality indicator in [0,1]. It is not candidate performance.';

CREATE INDEX IF NOT EXISTS pie_candidate_state_user_time_idx
  ON public.pie_candidate_state (user_id, state_timestamp DESC);

CREATE INDEX IF NOT EXISTS pie_candidate_state_user_sequence_idx
  ON public.pie_candidate_state (user_id, state_sequence DESC);

CREATE INDEX IF NOT EXISTS pie_candidate_state_model_idx
  ON public.pie_candidate_state (model_version);

ALTER TABLE public.pie_candidate_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_candidate_state_owner_select ON public.pie_candidate_state;
CREATE POLICY pie_candidate_state_owner_select
  ON public.pie_candidate_state
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pie_candidate_state_service_select ON public.pie_candidate_state;
CREATE POLICY pie_candidate_state_service_select
  ON public.pie_candidate_state
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_candidate_state_service_insert ON public.pie_candidate_state;
CREATE POLICY pie_candidate_state_service_insert
  ON public.pie_candidate_state
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_candidate_state_service_update ON public.pie_candidate_state;
CREATE POLICY pie_candidate_state_service_update
  ON public.pie_candidate_state
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_candidate_state_service_delete ON public.pie_candidate_state;
CREATE POLICY pie_candidate_state_service_delete
  ON public.pie_candidate_state
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_state_uncertainty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  candidate_state_id UUID NOT NULL
    REFERENCES public.pie_candidate_state(id)
    ON DELETE CASCADE,

  state_dimension TEXT NOT NULL
    CHECK (state_dimension IN (
      'CAPABILITY',
      'DECISION',
      'TIMING',
      'CALIBRATION',
      'SUSTAINED_PERFORMANCE',
      'LEARNING'
    )),

  estimate NUMERIC,

  lower_bound NUMERIC,
  upper_bound NUMERIC,

  variance NUMERIC
    CHECK (variance IS NULL OR variance >= 0),

  entropy NUMERIC
    CHECK (entropy IS NULL OR entropy >= 0),

  confidence_level NUMERIC
    CHECK (
      confidence_level IS NULL
      OR (confidence_level > 0 AND confidence_level < 1)
    ),

  evidence_count INTEGER
    CHECK (evidence_count IS NULL OR evidence_count >= 0),

  evidence_quality NUMERIC
    CHECK (
      evidence_quality IS NULL
      OR (evidence_quality >= 0 AND evidence_quality <= 1)
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_state_uncertainty_dimension_unique
    UNIQUE (candidate_state_id, state_dimension)
);

COMMENT ON TABLE public.pie_state_uncertainty IS
  'Uncertainty attached to each PIE candidate-state dimension. No state estimate is considered complete without uncertainty.';

COMMENT ON COLUMN public.pie_state_uncertainty.estimate IS
  'Point estimate only. The surrounding uncertainty fields are required for interpretation.';

COMMENT ON COLUMN public.pie_state_uncertainty.lower_bound IS
  'Lower bound of the model-defined uncertainty interval.';

COMMENT ON COLUMN public.pie_state_uncertainty.upper_bound IS
  'Upper bound of the model-defined uncertainty interval.';

CREATE INDEX IF NOT EXISTS pie_state_uncertainty_state_idx
  ON public.pie_state_uncertainty (candidate_state_id);

CREATE INDEX IF NOT EXISTS pie_state_uncertainty_dimension_idx
  ON public.pie_state_uncertainty (state_dimension);

ALTER TABLE public.pie_state_uncertainty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_state_uncertainty_owner_select ON public.pie_state_uncertainty;
CREATE POLICY pie_state_uncertainty_owner_select
  ON public.pie_state_uncertainty
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pie_candidate_state s
      WHERE s.id = candidate_state_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pie_state_uncertainty_service_select ON public.pie_state_uncertainty;
CREATE POLICY pie_state_uncertainty_service_select
  ON public.pie_state_uncertainty
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_state_uncertainty_service_insert ON public.pie_state_uncertainty;
CREATE POLICY pie_state_uncertainty_service_insert
  ON public.pie_state_uncertainty
  FOR INSERT
  TO service_role
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pie_candidate_state s
      WHERE s.id = candidate_state_id
    )
  );

DROP POLICY IF EXISTS pie_state_uncertainty_service_update ON public.pie_state_uncertainty;
CREATE POLICY pie_state_uncertainty_service_update
  ON public.pie_state_uncertainty
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pie_candidate_state s
      WHERE s.id = candidate_state_id
    )
  );

DROP POLICY IF EXISTS pie_state_uncertainty_service_delete ON public.pie_state_uncertainty;
CREATE POLICY pie_state_uncertainty_service_delete
  ON public.pie_state_uncertainty
  FOR DELETE
  TO service_role
  USING (true);

-- P0.3 deliberately creates storage only.
-- No trigger or SQL function calculates K/D/T/C/F/L.
-- No fixed weights, priors, thresholds, or readiness formula are introduced.
