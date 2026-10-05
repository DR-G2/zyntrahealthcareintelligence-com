-- PIE v1.0 P0.7: dynamic state
-- Purpose: persist time-varying performance dynamics separately from the
-- candidate state estimate itself.
-- No fixed fatigue thresholds, weights, or readiness formula are defined here.

CREATE TABLE IF NOT EXISTS public.pie_dynamic_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  candidate_state_id UUID
    REFERENCES public.pie_candidate_state(id) ON DELETE SET NULL,

  state_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  state_sequence BIGINT NOT NULL,

  stability_estimate NUMERIC,
  recovery_estimate NUMERIC,
  elasticity_estimate NUMERIC,
  inertia_estimate NUMERIC,
  velocity_estimate NUMERIC,
  change_point_probability NUMERIC,

  sustained_performance_decline_estimate NUMERIC,

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

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_dynamic_state_sequence_unique
    UNIQUE (user_id, state_sequence)
);

COMMENT ON TABLE public.pie_dynamic_state IS
  'Time-varying PIE performance dynamics. These estimates describe change over time and are not direct diagnoses of fatigue or other causes.';

COMMENT ON COLUMN public.pie_dynamic_state.stability_estimate IS
  'Estimated residual performance stability after accounting for expected task/context effects.';

COMMENT ON COLUMN public.pie_dynamic_state.recovery_estimate IS
  'Estimated recovery behaviour following a validated perturbation or performance decline.';

COMMENT ON COLUMN public.pie_dynamic_state.elasticity_estimate IS
  'Estimated performance response to a relevant change in task or environment.';

COMMENT ON COLUMN public.pie_dynamic_state.inertia_estimate IS
  'Estimated persistence of a prior state over time.';

COMMENT ON COLUMN public.pie_dynamic_state.velocity_estimate IS
  'Estimated rate of state change.';

COMMENT ON COLUMN public.pie_dynamic_state.change_point_probability IS
  'Probability that a meaningful state transition occurred near this observation window.';

COMMENT ON COLUMN public.pie_dynamic_state.sustained_performance_decline_estimate IS
  'User-facing-safe construct for sustained decline. It must not be interpreted as a direct measurement of physiological fatigue.';

CREATE INDEX IF NOT EXISTS pie_dynamic_state_user_time_idx
  ON public.pie_dynamic_state (user_id, state_timestamp DESC);

CREATE INDEX IF NOT EXISTS pie_dynamic_state_user_sequence_idx
  ON public.pie_dynamic_state (user_id, state_sequence);

CREATE INDEX IF NOT EXISTS pie_dynamic_state_model_idx
  ON public.pie_dynamic_state (model_version);

ALTER TABLE public.pie_dynamic_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_dynamic_state_owner_select ON public.pie_dynamic_state;
CREATE POLICY pie_dynamic_state_owner_select
  ON public.pie_dynamic_state
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_dynamic_state_service_select ON public.pie_dynamic_state;
CREATE POLICY pie_dynamic_state_service_select
  ON public.pie_dynamic_state
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_dynamic_state_service_insert ON public.pie_dynamic_state;
CREATE POLICY pie_dynamic_state_service_insert
  ON public.pie_dynamic_state
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dynamic_state_service_update ON public.pie_dynamic_state;
CREATE POLICY pie_dynamic_state_service_update
  ON public.pie_dynamic_state
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dynamic_state_service_delete ON public.pie_dynamic_state;
CREATE POLICY pie_dynamic_state_service_delete
  ON public.pie_dynamic_state
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_dynamic_observation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  session_id UUID,
  question_id UUID,
  question_version TEXT,

  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  performance_residual NUMERIC,
  timing_residual NUMERIC,
  confidence_residual NUMERIC,

  session_elapsed_ms BIGINT,
  question_elapsed_ms BIGINT,

  environment_state TEXT,
  interaction_state TEXT,

  observation_quality TEXT NOT NULL DEFAULT 'VALID'
    CHECK (
      observation_quality IN (
        'VALID',
        'SUSPICIOUS',
        'CONTRADICTORY',
        'UNUSABLE'
      )
    ),

  source_observation_id UUID
    REFERENCES public.pie_observation(id) ON DELETE SET NULL,

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_dynamic_observation IS
  'Time-indexed residual and context observations used to infer PIE dynamics. Raw observations remain in pie_observation.';

COMMENT ON COLUMN public.pie_dynamic_observation.performance_residual IS
  'Observed outcome minus the model-expected outcome under the relevant candidate/question/context state.';

COMMENT ON COLUMN public.pie_dynamic_observation.timing_residual IS
  'Observed timing relative to expected timing under the relevant task/context.';

COMMENT ON COLUMN public.pie_dynamic_observation.confidence_residual IS
  'Observed confidence relative to the expected calibration relationship.';

CREATE INDEX IF NOT EXISTS pie_dynamic_observation_user_time_idx
  ON public.pie_dynamic_observation (user_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS pie_dynamic_observation_session_idx
  ON public.pie_dynamic_observation (session_id, observed_at);

CREATE INDEX IF NOT EXISTS pie_dynamic_observation_source_idx
  ON public.pie_dynamic_observation (source_observation_id);

ALTER TABLE public.pie_dynamic_observation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_dynamic_observation_owner_select ON public.pie_dynamic_observation;
CREATE POLICY pie_dynamic_observation_owner_select
  ON public.pie_dynamic_observation
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_dynamic_observation_service_select ON public.pie_dynamic_observation;
CREATE POLICY pie_dynamic_observation_service_select
  ON public.pie_dynamic_observation
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_dynamic_observation_service_insert ON public.pie_dynamic_observation;
CREATE POLICY pie_dynamic_observation_service_insert
  ON public.pie_dynamic_observation
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dynamic_observation_service_update ON public.pie_dynamic_observation;
CREATE POLICY pie_dynamic_observation_service_update
  ON public.pie_dynamic_observation
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dynamic_observation_service_delete ON public.pie_dynamic_observation;
CREATE POLICY pie_dynamic_observation_service_delete
  ON public.pie_dynamic_observation
  FOR DELETE
  TO service_role
  USING (true);

-- P0.7 deliberately does not infer dynamics from raw attempts through a trigger.
-- The validated inference engine will construct residuals and dynamic estimates
-- using the model version and evidence available at inference time.
