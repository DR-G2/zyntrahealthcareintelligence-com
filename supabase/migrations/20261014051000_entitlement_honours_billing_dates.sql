-- Server-side expiry: question-bank RLS honours trial_end_at / current_period_end / cancel_at_period_end
-- (same rule as _shared/billing-lifecycle.ts entitlementFromRow; 48h renewal grace unless cancelled).
-- Requires 20261014040000 (columns). NOT applied live by this PR.
CREATE OR REPLACE FUNCTION public.payment_row_entitled(p public.payments)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.status = 'active' AND (
    CASE
      WHEN coalesce(p.current_period_end, p.trial_end_at) IS NULL THEN true -- legacy rows without dates
      WHEN p.cancel_at_period_end THEN now() < coalesce(p.current_period_end, p.trial_end_at)
      ELSE now() < coalesce(p.current_period_end, p.trial_end_at) + interval '48 hours'
    END
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_read_questions()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = auth.uid() AND public.payment_row_entitled(p))
    OR EXISTS (SELECT 1 FROM public.manual_overrides WHERE user_id = auth.uid() AND (expires_at IS NULL OR expires_at > now()))
    OR EXISTS (SELECT 1 FROM public.admin_roles WHERE email = auth.jwt() ->> 'email')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_can_read_questions() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_user_can_read_questions() TO authenticated;
