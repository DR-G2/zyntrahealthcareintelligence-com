-- Server-side expiry: question-bank RLS honours trial_end_at / current_period_end / cancel_at_period_end
-- (same rule as _shared/billing-lifecycle.ts entitlementFromRow; 48h renewal grace unless cancelled).
-- Requires 20261014040000 (columns). NOT applied live by this PR.
CREATE OR REPLACE FUNCTION public.payment_row_entitled(p public.payments)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT p.status = 'active' AND (
    CASE
      -- No dates: fail closed except the explicit legacy one-time 'lifetime' tier.
      WHEN coalesce(p.current_period_end, p.trial_end_at) IS NULL THEN p.tier = 'lifetime'
      WHEN p.cancel_at_period_end THEN now() < coalesce(p.current_period_end, p.trial_end_at)
      ELSE now() < coalesce(p.current_period_end, p.trial_end_at) + interval '48 hours'
    END
  )
$$;
REVOKE EXECUTE ON FUNCTION public.payment_row_entitled(public.payments) FROM PUBLIC, anon;
-- No GRANT: only called inside current_user_can_read_questions(), which is SECURITY DEFINER (runs as owner).

CREATE OR REPLACE FUNCTION public.current_user_can_read_questions()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = auth.uid() AND public.payment_row_entitled(p))
    OR EXISTS (SELECT 1 FROM public.manual_overrides WHERE user_id = auth.uid() AND (expires_at IS NULL OR expires_at > now()))
    OR EXISTS (SELECT 1 FROM public.admin_roles WHERE email = auth.jwt() ->> 'email')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_can_read_questions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_read_questions() TO authenticated;

-- Grant check (Hank V2): abort if anon/PUBLIC can execute the entitlement helpers.
DO $chk$
BEGIN
  IF has_function_privilege('anon', 'public.payment_row_entitled(public.payments)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.current_user_can_read_questions()', 'EXECUTE') THEN
    RAISE EXCEPTION 'entitlement helpers must not be executable by anon';
  END IF;
END
$chk$;
