-- P9 production safety hardening.
-- Internal PIE intelligence is service-role writable and never client-writable.
CREATE OR REPLACE FUNCTION public.pie_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

REVOKE ALL ON FUNCTION public.pie_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pie_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pie_is_admin() TO service_role;

-- Explicitly deny authenticated writes to all internal PIE tables.
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
    'pie_question_quarantine',
    'pie_dwig_candidate',
    'pie_dwig_selection',
    'pie_dwig_outcome',
    'pie_decision_candidate',
    'pie_decision',
    'pie_decision_outcome',
    'pie_inference_run',
    'pie_runtime_decision',
    'pie_runtime_gate',
    'pie_intervention_causal_evidence'
  ]
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', t);
  END LOOP;
END $$;

-- Admin inspection is a privileged path. Candidate-facing users do not receive
-- cross-user PIE intelligence through these tables.
COMMENT ON SCHEMA public IS 'PIE P9 hardening: internal intelligence writes require service_role or controlled SECURITY DEFINER RPCs.';
