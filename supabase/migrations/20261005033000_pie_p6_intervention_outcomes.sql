-- PIE P6: intervention outcome provenance and effect estimates.
-- Candidate-facing systems must not receive causal internals.

CREATE TABLE IF NOT EXISTS public.pie_intervention_outcome (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL,
  user_id UUID NOT NULL,
  baseline_state_id UUID,
  outcome_type TEXT NOT NULL,
  baseline_value NUMERIC,
  immediate_value NUMERIC,
  delayed_value NUMERIC,
  transfer_value NUMERIC,
  completed BOOLEAN NOT NULL DEFAULT false,
  outcome_quality NUMERIC NOT NULL DEFAULT 0
    CHECK (outcome_quality >= 0 AND outcome_quality <= 1),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_observation_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pie_intervention_outcome_user_idx
  ON public.pie_intervention_outcome (user_id, measured_at DESC);

CREATE INDEX IF NOT EXISTS pie_intervention_outcome_intervention_idx
  ON public.pie_intervention_outcome (intervention_id, measured_at DESC);

ALTER TABLE public.pie_intervention_outcome ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_intervention_outcome_owner_select ON public.pie_intervention_outcome;
CREATE POLICY pie_intervention_outcome_owner_select
  ON public.pie_intervention_outcome
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS pie_intervention_outcome_service_all ON public.pie_intervention_outcome;
CREATE POLICY pie_intervention_outcome_service_all
  ON public.pie_intervention_outcome
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.pie_intervention_effect_estimate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL,
  target_dimension TEXT NOT NULL,
  treatment_mean NUMERIC,
  comparison_mean NUMERIC,
  effect_estimate NUMERIC,
  uncertainty NUMERIC,
  sample_size INTEGER NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  evidence_quality NUMERIC NOT NULL DEFAULT 0 CHECK (evidence_quality >= 0 AND evidence_quality <= 1),
  confounding_risk NUMERIC NOT NULL DEFAULT 1 CHECK (confounding_risk >= 0 AND confounding_risk <= 1),
  design TEXT NOT NULL CHECK (design IN ('DESCRIPTIVE','QUASI_EXPERIMENTAL','RANDOMIZED')),
  causal_status TEXT NOT NULL CHECK (causal_status IN ('NOT_CAUSAL','PRELIMINARY_CAUSAL','CAUSAL')),
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pie_intervention_effect_idx
  ON public.pie_intervention_effect_estimate (intervention_id, created_at DESC);

ALTER TABLE public.pie_intervention_effect_estimate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_intervention_effect_service_all ON public.pie_intervention_effect_estimate;
CREATE POLICY pie_intervention_effect_service_all
  ON public.pie_intervention_effect_estimate
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.pie_intervention_effect_estimate IS
  'Internal intervention effect estimates. Descriptive/quasi-experimental effects are not causal claims.';
COMMENT ON COLUMN public.pie_intervention_effect_estimate.causal_status IS
  'Certification state. Non-randomized designs remain NOT_CAUSAL in the current P6 implementation.';
