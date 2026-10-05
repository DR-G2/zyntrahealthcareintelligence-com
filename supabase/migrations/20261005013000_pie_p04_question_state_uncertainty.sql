-- PIE v1.0 P0.4: question state and question uncertainty
-- Purpose: separate question metadata from inferred statistical question behaviour.
-- This migration does not alter question_dna and does not calculate candidate state.

CREATE TABLE IF NOT EXISTS public.pie_question_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  question_id UUID NOT NULL,
  question_version TEXT NOT NULL,

  difficulty_estimate NUMERIC,
  discrimination_estimate NUMERIC,
  ambiguity_estimate NUMERIC,
  novelty_estimate NUMERIC,

  cognitive_demand TEXT,
  evidence_level TEXT NOT NULL DEFAULT 'INSUFFICIENT',

  production_status TEXT,

  posterior_version INTEGER NOT NULL DEFAULT 1
    CHECK (posterior_version > 0),

  model_version TEXT NOT NULL,

  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_question_state_version_unique
    UNIQUE (question_id, question_version, posterior_version)
);

COMMENT ON TABLE public.pie_question_state IS
  'PIE statistical state of a question version. This is inference about question behaviour, not question metadata.';

COMMENT ON COLUMN public.pie_question_state.difficulty_estimate IS
  'Estimated task difficulty under the active question model. It is not a copied difficulty label from question_dna.';

COMMENT ON COLUMN public.pie_question_state.discrimination_estimate IS
  'Estimated ability-discrimination behaviour. It must retain uncertainty in pie_question_uncertainty.';

COMMENT ON COLUMN public.pie_question_state.ambiguity_estimate IS
  'Estimated ambiguity risk based on validated evidence. It is not a direct candidate judgement.';

COMMENT ON COLUMN public.pie_question_state.novelty_estimate IS
  'Estimated novelty relative to the question model/evidence set.';

COMMENT ON COLUMN public.pie_question_state.evidence_level IS
  'Qualitative evidence level. It must not be reduced to an arbitrary attempt-count rule.';

CREATE INDEX IF NOT EXISTS pie_question_state_question_idx
  ON public.pie_question_state (question_id, question_version);

CREATE INDEX IF NOT EXISTS pie_question_state_model_idx
  ON public.pie_question_state (model_version);

ALTER TABLE public.pie_question_state ENABLE ROW LEVEL SECURITY;

-- Question intelligence is not candidate-owned.
-- Authenticated users must not receive the statistical internals by default.
-- Service role is used by inference/admin paths.

DROP POLICY IF EXISTS pie_question_state_service_select ON public.pie_question_state;
CREATE POLICY pie_question_state_service_select
  ON public.pie_question_state
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_question_state_service_insert ON public.pie_question_state;
CREATE POLICY pie_question_state_service_insert
  ON public.pie_question_state
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_question_state_service_update ON public.pie_question_state;
CREATE POLICY pie_question_state_service_update
  ON public.pie_question_state
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_question_state_service_delete ON public.pie_question_state;
CREATE POLICY pie_question_state_service_delete
  ON public.pie_question_state
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_question_uncertainty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  question_id UUID NOT NULL,
  question_version TEXT NOT NULL,

  parameter_name TEXT NOT NULL,

  estimate NUMERIC,

  lower_bound NUMERIC,
  upper_bound NUMERIC,

  uncertainty_measure NUMERIC
    CHECK (uncertainty_measure IS NULL OR uncertainty_measure >= 0),

  evidence_count INTEGER NOT NULL DEFAULT 0
    CHECK (evidence_count >= 0),

  evidence_quality NUMERIC
    CHECK (
      evidence_quality IS NULL
      OR (evidence_quality >= 0 AND evidence_quality <= 1)
    ),

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_question_uncertainty_parameter_unique
    UNIQUE (
      question_id,
      question_version,
      parameter_name,
      model_version
    )
);

COMMENT ON TABLE public.pie_question_uncertainty IS
  'Uncertainty for inferred question parameters. Question uncertainty must be represented separately from candidate uncertainty.';

COMMENT ON COLUMN public.pie_question_uncertainty.parameter_name IS
  'Inference parameter such as difficulty, discrimination, ambiguity, or novelty.';

COMMENT ON COLUMN public.pie_question_uncertainty.evidence_quality IS
  'Quality of the evidence supporting this parameter, not question difficulty and not candidate performance.';

CREATE INDEX IF NOT EXISTS pie_question_uncertainty_question_idx
  ON public.pie_question_uncertainty (question_id, question_version);

CREATE INDEX IF NOT EXISTS pie_question_uncertainty_parameter_idx
  ON public.pie_question_uncertainty (parameter_name);

ALTER TABLE public.pie_question_uncertainty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_question_uncertainty_service_select ON public.pie_question_uncertainty;
CREATE POLICY pie_question_uncertainty_service_select
  ON public.pie_question_uncertainty
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_question_uncertainty_service_insert ON public.pie_question_uncertainty;
CREATE POLICY pie_question_uncertainty_service_insert
  ON public.pie_question_uncertainty
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_question_uncertainty_service_update ON public.pie_question_uncertainty;
CREATE POLICY pie_question_uncertainty_service_update
  ON public.pie_question_uncertainty
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_question_uncertainty_service_delete ON public.pie_question_uncertainty;
CREATE POLICY pie_question_uncertainty_service_delete
  ON public.pie_question_uncertainty
  FOR DELETE
  TO service_role
  USING (true);

-- Question inference must not be allowed to feed directly back into the same
-- observation without an independent validation path.
-- Anti-circularity is enforced at the inference layer in P0.7+.
