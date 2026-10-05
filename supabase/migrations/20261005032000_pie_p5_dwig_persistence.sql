-- PIE P5: persist DWIG evaluation and selection provenance.
-- This table stores model outputs. It does not make the selection a causal claim.

CREATE TABLE IF NOT EXISTS public.pie_dwig_evaluation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  decision_context TEXT NOT NULL,
  question_id UUID,
  question_version TEXT,
  model_version TEXT NOT NULL,
  expected_information_gain NUMERIC,
  expected_decision_uncertainty_reduction NUMERIC,
  expected_outcome_value NUMERIC,
  expected_cost NUMERIC,
  completion_probability NUMERIC
    CHECK (completion_probability IS NULL OR (completion_probability >= 0 AND completion_probability <= 1)),
  decision_stability_after_observation NUMERIC,
  evidence_quality NUMERIC
    CHECK (evidence_quality IS NULL OR (evidence_quality >= 0 AND evidence_quality <= 1)),
  utility_estimate NUMERIC,
  eligible BOOLEAN NOT NULL DEFAULT false,
  exclusion_reason TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pie_dwig_evaluation_user_time_idx
  ON public.pie_dwig_evaluation (user_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS pie_dwig_evaluation_question_idx
  ON public.pie_dwig_evaluation (question_id, question_version, evaluated_at DESC);

ALTER TABLE public.pie_dwig_evaluation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_dwig_evaluation_owner_select ON public.pie_dwig_evaluation;
CREATE POLICY pie_dwig_evaluation_owner_select
  ON public.pie_dwig_evaluation
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS pie_dwig_evaluation_service_all ON public.pie_dwig_evaluation;
CREATE POLICY pie_dwig_evaluation_service_all
  ON public.pie_dwig_evaluation
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.pie_dwig_evaluation IS
  'Per-question DWIG evaluation provenance. Expected values are model estimates, not observed causal effects.';

ALTER TABLE public.pie_dwig_selection
  ADD COLUMN IF NOT EXISTS model_version TEXT,
  ADD COLUMN IF NOT EXISTS decision_uncertainty_before NUMERIC,
  ADD COLUMN IF NOT EXISTS decision_uncertainty_after_expected NUMERIC,
  ADD COLUMN IF NOT EXISTS expected_information_gain NUMERIC,
  ADD COLUMN IF NOT EXISTS selection_reason TEXT;

COMMENT ON COLUMN public.pie_dwig_selection.expected_information_gain IS
  'Expected information gain only. It must not be interpreted as observed information gain or causal intervention effect.';
