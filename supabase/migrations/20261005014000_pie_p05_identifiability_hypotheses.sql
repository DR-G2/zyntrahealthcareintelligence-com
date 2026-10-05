-- PIE v1.0 P0.5: identifiability and competing hypotheses
-- Purpose: represent unresolved/provisional/decision-level state identification.
-- This migration stores inference evidence. It does not force a diagnosis.

CREATE TABLE IF NOT EXISTS public.pie_identifiability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL,

  state_dimension TEXT NOT NULL
    CHECK (state_dimension IN (
      'CAPABILITY',
      'DECISION',
      'TIMING',
      'CALIBRATION',
      'SUSTAINED_PERFORMANCE',
      'LEARNING'
    )),

  status TEXT NOT NULL DEFAULT 'UNRESOLVED'
    CHECK (status IN (
      'UNRESOLVED',
      'PROVISIONALLY_IDENTIFIED',
      'IDENTIFIED_FOR_DECISION'
    )),

  evidence_count INTEGER NOT NULL DEFAULT 0
    CHECK (evidence_count >= 0),

  evidence_coverage NUMERIC
    CHECK (
      evidence_coverage IS NULL
      OR (evidence_coverage >= 0 AND evidence_coverage <= 1)
    ),

  competing_hypothesis_count INTEGER NOT NULL DEFAULT 0
    CHECK (competing_hypothesis_count >= 0),

  separating_observation_count INTEGER NOT NULL DEFAULT 0
    CHECK (separating_observation_count >= 0),

  required_next_observation TEXT,

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_identifiability IS
  'PIE identifiability state. A candidate state is not considered identified merely because one explanation fits the observations.';

COMMENT ON COLUMN public.pie_identifiability.status IS
  'UNRESOLVED when competing explanations cannot be separated; PROVISIONALLY_IDENTIFIED when evidence supports a working interpretation; IDENTIFIED_FOR_DECISION only when evidence is sufficient for the relevant decision.';

COMMENT ON COLUMN public.pie_identifiability.evidence_coverage IS
  'Coverage of relevant conditions/tasks needed to distinguish competing explanations. It is not a fixed question-count score.';

COMMENT ON COLUMN public.pie_identifiability.required_next_observation IS
  'Human-readable description of the observation that would most reduce the relevant identification uncertainty.';

CREATE INDEX IF NOT EXISTS pie_identifiability_user_dimension_idx
  ON public.pie_identifiability (user_id, state_dimension, created_at DESC);

CREATE INDEX IF NOT EXISTS pie_identifiability_status_idx
  ON public.pie_identifiability (status);

ALTER TABLE public.pie_identifiability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_identifiability_owner_select ON public.pie_identifiability;
CREATE POLICY pie_identifiability_owner_select
  ON public.pie_identifiability
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pie_identifiability_service_select ON public.pie_identifiability;
CREATE POLICY pie_identifiability_service_select
  ON public.pie_identifiability
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_identifiability_service_insert ON public.pie_identifiability;
CREATE POLICY pie_identifiability_service_insert
  ON public.pie_identifiability
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_identifiability_service_update ON public.pie_identifiability;
CREATE POLICY pie_identifiability_service_update
  ON public.pie_identifiability
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_identifiability_service_delete ON public.pie_identifiability;
CREATE POLICY pie_identifiability_service_delete
  ON public.pie_identifiability
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_hypothesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL,

  state_dimension TEXT NOT NULL
    CHECK (state_dimension IN (
      'CAPABILITY',
      'DECISION',
      'TIMING',
      'CALIBRATION',
      'SUSTAINED_PERFORMANCE',
      'LEARNING'
    )),

  hypothesis_code TEXT NOT NULL,

  posterior_probability NUMERIC
    CHECK (
      posterior_probability IS NULL
      OR (posterior_probability >= 0 AND posterior_probability <= 1)
    ),

  prior_probability NUMERIC
    CHECK (
      prior_probability IS NULL
      OR (prior_probability >= 0 AND prior_probability <= 1)
    ),

  evidence_for JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_against JSONB NOT NULL DEFAULT '[]'::jsonb,

  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN (
      'ACTIVE',
      'SUPPORTED',
      'WEAKENED',
      'REJECTED',
      'UNRESOLVED'
    )),

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_hypothesis IS
  'Competing explanations for a candidate state. Hypotheses are evidence-bearing inference records, not diagnoses.';

COMMENT ON COLUMN public.pie_hypothesis.posterior_probability IS
  'Model-estimated support for this hypothesis. It must not be interpreted as certainty.';

COMMENT ON COLUMN public.pie_hypothesis.evidence_for IS
  'Provenance references or structured evidence supporting this hypothesis.';

COMMENT ON COLUMN public.pie_hypothesis.evidence_against IS
  'Provenance references or structured evidence that weakens this hypothesis.';

CREATE INDEX IF NOT EXISTS pie_hypothesis_user_dimension_idx
  ON public.pie_hypothesis (user_id, state_dimension, created_at DESC);

CREATE INDEX IF NOT EXISTS pie_hypothesis_status_idx
  ON public.pie_hypothesis (status);

ALTER TABLE public.pie_hypothesis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_hypothesis_owner_select ON public.pie_hypothesis;
CREATE POLICY pie_hypothesis_owner_select
  ON public.pie_hypothesis
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pie_hypothesis_service_select ON public.pie_hypothesis;
CREATE POLICY pie_hypothesis_service_select
  ON public.pie_hypothesis
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_hypothesis_service_insert ON public.pie_hypothesis;
CREATE POLICY pie_hypothesis_service_insert
  ON public.pie_hypothesis
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_hypothesis_service_update ON public.pie_hypothesis;
CREATE POLICY pie_hypothesis_service_update
  ON public.pie_hypothesis
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_hypothesis_service_delete ON public.pie_hypothesis;
CREATE POLICY pie_hypothesis_service_delete
  ON public.pie_hypothesis
  FOR DELETE
  TO service_role
  USING (true);

-- P0.5 deliberately stores the competing explanations only.
-- Identification logic and hypothesis probabilities are implemented by the
-- versioned inference engine, not by a fixed SQL scoring rule.
