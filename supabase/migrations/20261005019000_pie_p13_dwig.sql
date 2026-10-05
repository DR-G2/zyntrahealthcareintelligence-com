-- PIE v1.0 P1.3: Decision-Weighted Information Gain
-- Purpose: persist candidate-observation decision value and the selected
-- next observation/action candidate.
-- DWIG is an inference output. This migration does not implement a fixed
-- weighted score or a hard-coded question priority formula.

CREATE TABLE IF NOT EXISTS public.pie_dwig_candidate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  decision_context TEXT NOT NULL,

  candidate_type TEXT NOT NULL
    CHECK (
      candidate_type IN (
        'QUESTION',
        'TASK',
        'PERTURBATION',
        'INTERVENTION',
        'OBSERVATION'
      )
    ),

  candidate_id TEXT NOT NULL,

  expected_information_gain NUMERIC
    CHECK (
      expected_information_gain IS NULL
      OR expected_information_gain >= 0
    ),

  expected_decision_uncertainty_reduction NUMERIC
    CHECK (
      expected_decision_uncertainty_reduction IS NULL
      OR expected_decision_uncertainty_reduction >= 0
    ),

  expected_outcome_uncertainty NUMERIC
    CHECK (
      expected_outcome_uncertainty IS NULL
      OR expected_outcome_uncertainty >= 0
    ),

  expected_cost NUMERIC
    CHECK (
      expected_cost IS NULL OR expected_cost >= 0
    ),

  utility_estimate NUMERIC,

  rank_position INTEGER
    CHECK (
      rank_position IS NULL OR rank_position > 0
    ),

  decision_stability_before NUMERIC
    CHECK (
      decision_stability_before IS NULL
      OR (decision_stability_before >= 0 AND decision_stability_before <= 1)
    ),

  decision_stability_after_expected NUMERIC
    CHECK (
      decision_stability_after_expected IS NULL
      OR (
        decision_stability_after_expected >= 0
        AND decision_stability_after_expected <= 1
      )
    ),

  uncertainty_measure NUMERIC
    CHECK (
      uncertainty_measure IS NULL OR uncertainty_measure >= 0
    ),

  evidence_count INTEGER NOT NULL DEFAULT 0
    CHECK (evidence_count >= 0),

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_dwig_candidate IS
  'Decision-Weighted Information Gain candidates. Records how a possible next observation is expected to reduce uncertainty relevant to a decision.';

COMMENT ON COLUMN public.pie_dwig_candidate.expected_information_gain IS
  'Expected reduction in state uncertainty from the candidate observation.';

COMMENT ON COLUMN public.pie_dwig_candidate.expected_decision_uncertainty_reduction IS
  'Expected reduction in uncertainty about the decision that matters. This is the primary decision-oriented quantity, not raw question difficulty.';

COMMENT ON COLUMN public.pie_dwig_candidate.utility_estimate IS
  'Optional model output combining expected decision value and candidate cost. No fixed utility weights are defined by the schema.';

CREATE INDEX IF NOT EXISTS pie_dwig_candidate_user_time_idx
  ON public.pie_dwig_candidate (user_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS pie_dwig_candidate_rank_idx
  ON public.pie_dwig_candidate (user_id, evaluated_at DESC, rank_position);

CREATE INDEX IF NOT EXISTS pie_dwig_candidate_context_idx
  ON public.pie_dwig_candidate (decision_context);

ALTER TABLE public.pie_dwig_candidate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_dwig_candidate_owner_select ON public.pie_dwig_candidate;
CREATE POLICY pie_dwig_candidate_owner_select
  ON public.pie_dwig_candidate
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_dwig_candidate_service_select ON public.pie_dwig_candidate;
CREATE POLICY pie_dwig_candidate_service_select
  ON public.pie_dwig_candidate
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_dwig_candidate_service_insert ON public.pie_dwig_candidate;
CREATE POLICY pie_dwig_candidate_service_insert
  ON public.pie_dwig_candidate
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dwig_candidate_service_update ON public.pie_dwig_candidate;
CREATE POLICY pie_dwig_candidate_service_update
  ON public.pie_dwig_candidate
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dwig_candidate_service_delete ON public.pie_dwig_candidate;
CREATE POLICY pie_dwig_candidate_service_delete
  ON public.pie_dwig_candidate
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_dwig_selection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  decision_context TEXT NOT NULL,

  selected_candidate_id UUID
    REFERENCES public.pie_dwig_candidate(id) ON DELETE SET NULL,

  selection_reason TEXT,

  expected_decision_uncertainty_reduction NUMERIC
    CHECK (
      expected_decision_uncertainty_reduction IS NULL
      OR expected_decision_uncertainty_reduction >= 0
    ),

  selection_uncertainty NUMERIC
    CHECK (
      selection_uncertainty IS NULL OR selection_uncertainty >= 0
    ),

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_dwig_selection IS
  'Versioned record of the DWIG-selected next observation candidate. It records the decision context and expected value before execution.';

CREATE INDEX IF NOT EXISTS pie_dwig_selection_user_time_idx
  ON public.pie_dwig_selection (user_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS pie_dwig_selection_candidate_idx
  ON public.pie_dwig_selection (selected_candidate_id);

ALTER TABLE public.pie_dwig_selection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_dwig_selection_owner_select ON public.pie_dwig_selection;
CREATE POLICY pie_dwig_selection_owner_select
  ON public.pie_dwig_selection
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_dwig_selection_service_select ON public.pie_dwig_selection;
CREATE POLICY pie_dwig_selection_service_select
  ON public.pie_dwig_selection
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_dwig_selection_service_insert ON public.pie_dwig_selection;
CREATE POLICY pie_dwig_selection_service_insert
  ON public.pie_dwig_selection
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dwig_selection_service_update ON public.pie_dwig_selection;
CREATE POLICY pie_dwig_selection_service_update
  ON public.pie_dwig_selection
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dwig_selection_service_delete ON public.pie_dwig_selection;
CREATE POLICY pie_dwig_selection_service_delete
  ON public.pie_dwig_selection
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_dwig_outcome (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  selection_id UUID NOT NULL
    REFERENCES public.pie_dwig_selection(id) ON DELETE CASCADE,

  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  executed_candidate_id UUID
    REFERENCES public.pie_dwig_candidate(id) ON DELETE SET NULL,

  observed_information_gain NUMERIC
    CHECK (
      observed_information_gain IS NULL
      OR observed_information_gain >= 0
    ),

  observed_decision_uncertainty_before NUMERIC
    CHECK (
      observed_decision_uncertainty_before IS NULL
      OR observed_decision_uncertainty_before >= 0
    ),

  observed_decision_uncertainty_after NUMERIC
    CHECK (
      observed_decision_uncertainty_after IS NULL
      OR observed_decision_uncertainty_after >= 0
    ),

  decision_changed BOOLEAN,

  outcome_quality NUMERIC
    CHECK (
      outcome_quality IS NULL
      OR (outcome_quality >= 0 AND outcome_quality <= 1)
    ),

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_dwig_outcome IS
  'Observed value of a previously selected DWIG candidate. This enables validation of whether predicted information value matches observed information value.';

CREATE INDEX IF NOT EXISTS pie_dwig_outcome_user_time_idx
  ON public.pie_dwig_outcome (user_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS pie_dwig_outcome_selection_idx
  ON public.pie_dwig_outcome (selection_id);

ALTER TABLE public.pie_dwig_outcome ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_dwig_outcome_owner_select ON public.pie_dwig_outcome;
CREATE POLICY pie_dwig_outcome_owner_select
  ON public.pie_dwig_outcome
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_dwig_outcome_service_select ON public.pie_dwig_outcome;
CREATE POLICY pie_dwig_outcome_service_select
  ON public.pie_dwig_outcome
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_dwig_outcome_service_insert ON public.pie_dwig_outcome;
CREATE POLICY pie_dwig_outcome_service_insert
  ON public.pie_dwig_outcome
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dwig_outcome_service_update ON public.pie_dwig_outcome;
CREATE POLICY pie_dwig_outcome_service_update
  ON public.pie_dwig_outcome
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_dwig_outcome_service_delete ON public.pie_dwig_outcome;
CREATE POLICY pie_dwig_outcome_service_delete
  ON public.pie_dwig_outcome
  FOR DELETE
  TO service_role
  USING (true);

-- P1.3 deliberately contains no hard-coded weights, question-count rules,
-- readiness thresholds, or intervention effects.
-- DWIG implementation will be supplied by the validated inference/decision
-- engine and must be evaluated against observed information gain.
