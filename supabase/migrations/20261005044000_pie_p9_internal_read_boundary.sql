-- PIE P9 security boundary.
-- Internal PIE intelligence must not be directly readable by candidate clients.
-- Candidate-facing surfaces must use controlled Edge Functions/API responses.
-- service_role remains the controlled internal reader/writer.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pie_candidate_state',
    'pie_state_uncertainty',
    'pie_dynamic_state',
    'pie_dynamic_observation',
    'pie_question_state',
    'pie_question_uncertainty',
    'pie_question_quarantine',
    'pie_dwig_candidate',
    'pie_dwig_evaluation',
    'pie_dwig_selection',
    'pie_dwig_outcome',
    'pie_decision_candidate',
    'pie_decision',
    'pie_decision_outcome',
    'pie_inference_run',
    'pie_runtime_decision',
    'pie_runtime_gate',
    'pie_intervention_outcome',
    'pie_intervention_effect_estimate',
    'pie_intervention_causal_evidence'
  ]
  LOOP
    EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated', t);
  END LOOP;
END $$;

-- Remove owner-readable policies from internal intelligence tables.
DROP POLICY IF EXISTS pie_candidate_state_owner_select ON public.pie_candidate_state;
DROP POLICY IF EXISTS pie_state_uncertainty_owner_select ON public.pie_state_uncertainty;
DROP POLICY IF EXISTS pie_dynamic_state_owner_select ON public.pie_dynamic_state;
DROP POLICY IF EXISTS pie_dynamic_observation_owner_select ON public.pie_dynamic_observation;
DROP POLICY IF EXISTS pie_inference_run_owner_select ON public.pie_inference_run;
DROP POLICY IF EXISTS pie_dwig_evaluation_owner_select ON public.pie_dwig_evaluation;
DROP POLICY IF EXISTS pie_dwig_selection_owner_select ON public.pie_dwig_selection;
DROP POLICY IF EXISTS pie_dwig_outcome_owner_select ON public.pie_dwig_outcome;
DROP POLICY IF EXISTS pie_decision_candidate_owner_select ON public.pie_decision_candidate;
DROP POLICY IF EXISTS pie_decision_owner_select ON public.pie_decision;
DROP POLICY IF EXISTS pie_decision_outcome_owner_select ON public.pie_decision_outcome;
DROP POLICY IF EXISTS pie_runtime_decision_owner_select ON public.pie_runtime_decision;
DROP POLICY IF EXISTS pie_intervention_outcome_owner_select ON public.pie_intervention_outcome;

-- Explicitly remove authenticated write privileges as well.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pie_candidate_state',
    'pie_state_uncertainty',
    'pie_dynamic_state',
    'pie_dynamic_observation',
    'pie_question_state',
    'pie_question_uncertainty',
    'pie_question_quarantine',
    'pie_dwig_candidate',
    'pie_dwig_evaluation',
    'pie_dwig_selection',
    'pie_dwig_outcome',
    'pie_decision_candidate',
    'pie_decision',
    'pie_decision_outcome',
    'pie_inference_run',
    'pie_runtime_decision',
    'pie_runtime_gate',
    'pie_intervention_outcome',
    'pie_intervention_effect_estimate',
    'pie_intervention_causal_evidence'
  ]
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated',
      t
    );
  END LOOP;
END $$;

COMMENT ON SCHEMA public IS
  'PIE internal intelligence is service-role controlled. Candidate clients must use controlled API/Edge Function surfaces.';
