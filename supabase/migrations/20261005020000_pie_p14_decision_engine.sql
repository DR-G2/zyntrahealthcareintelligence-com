-- PIE v1.0 P1.4: decision engine
-- Purpose: persist decision candidates, selected decisions, and observed
-- decision outcomes.
-- This layer consumes validated inference outputs. It does not define
-- arbitrary action weights or claim causal intervention effects.

CREATE TABLE IF NOT EXISTS public.pie_decision_candidate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  decision_context TEXT NOT NULL,

  action_type TEXT NOT NULL
    CHECK (
      action_type IN (
        'NEXT_QUESTION',
        'NEXT_TASK',
        'PERTURBATION',
        'INTERVENTION',
        'REST',
        'CONTINUE',
        'STOP',
        'REVIEW'
      )
    ),

  action_reference TEXT,

  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  expected_readiness_change NUMERIC,

  expected_decision_value NUMERIC,

  expected_completion_probability NUMERIC
    CHECK (
      expected_completion_probability IS NULL
      OR (
        expected_completion_probability >= 0
        AND expected_completion_probability <= 1
      )
    ),

  expected_cost NUMERIC
    CHECK (
      expected_cost IS NULL OR expected_cost >= 0
    ),

  expected_utility NUMERIC,

  uncertainty_measure NUMERIC
    CHECK (
      uncertainty_measure IS NULL OR uncertainty_measure >= 0
    ),

  evidence_count INTEGER NOT NULL DEFAULT 0
    CHECK (evidence_count >= 0),

  decision_stability NUMERIC
    CHECK (
      decision_stability IS NULL
      OR (decision_stability >= 0 AND decision_stability <= 1)
    ),

  rank_position INTEGER
    CHECK (
      rank_position IS NULL OR rank_position > 0
    ),

  dwig_candidate_id UUID
    REFERENCES public.pie_dwig_candidate(id) ON DELETE SET NULL,

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_decision_candidate IS
  'Candidate actions considered by the PIE decision engine. Utility is model output and must not be interpreted as a causal effect.';

COMMENT ON COLUMN public.pie_decision_candidate.expected_readiness_change IS
  'Predicted change in the relevant exam-specific readiness output. It is not a guaranteed intervention effect.';

COMMENT ON COLUMN public.pie_decision_candidate.expected_decision_value IS
  'Expected value for the current decision context.';

COMMENT ON COLUMN public.pie_decision_candidate.expected_utility IS
  'Model-computed expected utility. The schema does not impose fixed utility weights.';

CREATE INDEX IF NOT EXISTS pie_decision_candidate_user_time_idx
  ON public.pie_decision_candidate (user_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS pie_decision_candidate_rank_idx
  ON public.pie_decision_candidate (user_id, evaluated_at DESC, rank_position);

CREATE INDEX IF NOT EXISTS pie_decision_candidate_dwig_idx
  ON public.pie_decision_candidate (dwig_candidate_id);

ALTER TABLE public.pie_decision_candidate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_decision_candidate_owner_select ON public.pie_decision_candidate;
CREATE POLICY pie_decision_candidate_owner_select
  ON public.pie_decision_candidate
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_decision_candidate_service_select ON public.pie_decision_candidate;
CREATE POLICY pie_decision_candidate_service_select
  ON public.pie_decision_candidate
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_decision_candidate_service_insert ON public.pie_decision_candidate;
CREATE POLICY pie_decision_candidate_service_insert
  ON public.pie_decision_candidate
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_decision_candidate_service_update ON public.pie_decision_candidate;
CREATE POLICY pie_decision_candidate_service_update
  ON public.pie_decision_candidate
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_decision_candidate_service_delete ON public.pie_decision_candidate;
CREATE POLICY pie_decision_candidate_service_delete
  ON public.pie_decision_candidate
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  decision_context TEXT NOT NULL,

  selected_candidate_id UUID
    REFERENCES public.pie_decision_candidate(id) ON DELETE SET NULL,

  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  decision_reason TEXT,

  expected_utility NUMERIC,

  decision_uncertainty NUMERIC
    CHECK (
      decision_uncertainty IS NULL OR decision_uncertainty >= 0
    ),

  readiness_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_decision IS
  'Versioned record of the action selected by PIE for a specific decision context.';

COMMENT ON COLUMN public.pie_decision.readiness_snapshot IS
  'Readiness evidence available when the decision was made.';

COMMENT ON COLUMN public.pie_decision.state_snapshot IS
  'Core candidate-state evidence available when the decision was made.';

CREATE INDEX IF NOT EXISTS pie_decision_user_time_idx
  ON public.pie_decision (user_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS pie_decision_context_idx
  ON public.pie_decision (decision_context);

ALTER TABLE public.pie_decision ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_decision_owner_select ON public.pie_decision;
CREATE POLICY pie_decision_owner_select
  ON public.pie_decision
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_decision_service_select ON public.pie_decision;
CREATE POLICY pie_decision_service_select
  ON public.pie_decision
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_decision_service_insert ON public.pie_decision;
CREATE POLICY pie_decision_service_insert
  ON public.pie_decision
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_decision_service_update ON public.pie_decision;
CREATE POLICY pie_decision_service_update
  ON public.pie_decision
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_decision_service_delete ON public.pie_decision;
CREATE POLICY pie_decision_service_delete
  ON public.pie_decision
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_decision_outcome (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  decision_id UUID NOT NULL
    REFERENCES public.pie_decision(id) ON DELETE CASCADE,

  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  outcome_type TEXT NOT NULL
    CHECK (
      outcome_type IN (
        'COMPLETED',
        'PARTIALLY_COMPLETED',
        'NOT_COMPLETED',
        'INVALIDATED',
        'UNKNOWN'
      )
    ),

  observed_readiness_before NUMERIC,
  observed_readiness_after NUMERIC,

  observed_decision_value NUMERIC,

  observed_cost NUMERIC
    CHECK (
      observed_cost IS NULL OR observed_cost >= 0
    ),

  outcome_quality NUMERIC
    CHECK (
      outcome_quality IS NULL
      OR (outcome_quality >= 0 AND outcome_quality <= 1)
    ),

  state_change_observed BOOLEAN,

  notes TEXT,

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_decision_outcome IS
  'Observed outcome of a PIE decision. This is required before later intervention-effectiveness claims can be made.';

COMMENT ON COLUMN public.pie_decision_outcome.observed_readiness_after IS
  'Observed downstream readiness estimate. It is not by itself a causal treatment effect.';

CREATE INDEX IF NOT EXISTS pie_decision_outcome_user_time_idx
  ON public.pie_decision_outcome (user_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS pie_decision_outcome_decision_idx
  ON public.pie_decision_outcome (decision_id);

ALTER TABLE public.pie_decision_outcome ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_decision_outcome_owner_select ON public.pie_decision_outcome;
CREATE POLICY pie_decision_outcome_owner_select
  ON public.pie_decision_outcome
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_decision_outcome_service_select ON public.pie_decision_outcome;
CREATE POLICY pie_decision_outcome_service_select
  ON public.pie_decision_outcome
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_decision_outcome_service_insert ON public.pie_decision_outcome;
CREATE POLICY pie_decision_outcome_service_insert
  ON public.pie_decision_outcome
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_decision_outcome_service_update ON public.pie_decision_outcome;
CREATE POLICY pie_decision_outcome_service_update
  ON public.pie_decision_outcome
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_decision_outcome_service_delete ON public.pie_decision_outcome;
CREATE POLICY pie_decision_outcome_service_delete
  ON public.pie_decision_outcome
  FOR DELETE
  TO service_role
  USING (true);

-- P1.4 deliberately does not implement causal intervention learning.
-- Observed outcomes are retained separately so later causal validation can
-- distinguish prediction from intervention effect.
