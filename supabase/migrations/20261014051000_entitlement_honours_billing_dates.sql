-- Server-side expiry: question-bank RLS honours trial_end_at / current_period_end / cancel_at_period_end
-- (same rule as _shared/billing-lifecycle.ts entitlementFromRow; 48h renewal grace unless cancelled).
-- Requires 20261014040000 (columns). NOT applied live by this PR.
CREATE OR REPLACE FUNCTION public.payment_row_entitled(p public.payments)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.status = 'active' AND (
    CASE
      -- No dates: fail closed except the explicit legacy one-time 'lifetime' tier.
      WHEN coalesce(p.current_period_end, p.trial_end_at) IS NULL THEN p.tier = 'lifetime'
      WHEN p.cancel_at_period_end THEN now() < coalesce(p.current_period_end, p.trial_end_at)
      ELSE now() < coalesce(p.current_period_end, p.trial_end_at) + interval '48 hours'
    END
  )
$$;
-- Hank B2: V2 default privileges grant EXECUTE on new functions to anon/authenticated, so revoke explicitly.
REVOKE ALL ON FUNCTION public.payment_row_entitled(public.payments) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_row_entitled(public.payments) TO service_role;
-- Only callers: current_user_can_read_questions() (SECURITY DEFINER, runs as owner) and service_role.

-- Admin check (V2): the existing admin allowlist is pie.security_admin_allowlist (used by admin_* fns), so no
-- admin_roles duplicate. Email comes from the caller's JWT and must be confirmed in auth.users; _email is kept only
-- for the App.tsx AdminGate RPC signature and is ignored (callers can only ask about themselves).
CREATE OR REPLACE FUNCTION public.is_admin(_email text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL OR to_regclass('pie.security_admin_allowlist') IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM auth.users u
    JOIN pie.security_admin_allowlist a ON a.enabled = true AND a.user_id = u.id AND lower(a.email) = v_email
    WHERE u.id = auth.uid() AND lower(u.email) = v_email AND u.email_confirmed_at IS NOT NULL
  );
END
$$;
REVOKE ALL ON FUNCTION public.is_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_can_read_questions()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.payments p WHERE p.user_id = auth.uid() AND public.payment_row_entitled(p))
    OR EXISTS (SELECT 1 FROM public.manual_overrides WHERE user_id = auth.uid() AND (expires_at IS NULL OR expires_at > now()))
    OR public.is_admin(NULL)
  )
$$;
REVOKE ALL ON FUNCTION public.current_user_can_read_questions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_read_questions() TO authenticated;

-- Grant check (Hank B2): abort on any unexpected EXECUTE.
DO $chk$
BEGIN
  IF has_function_privilege('anon', 'public.payment_row_entitled(public.payments)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.payment_row_entitled(public.payments)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.current_user_can_read_questions()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.is_admin(text)', 'EXECUTE')
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.payment_row_entitled(public.payments)'::regprocedure)
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.current_user_can_read_questions()'::regprocedure)
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.is_admin(text)'::regprocedure)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.is_admin(text)'::regprocedure
                    AND proconfig @> ARRAY['search_path=""']::text[])
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                WHERE p.oid IN ('public.payment_row_entitled(public.payments)'::regprocedure,
                                'public.current_user_can_read_questions()'::regprocedure,
                                'public.is_admin(text)'::regprocedure)
                  AND a.grantee = 0) THEN
    RAISE EXCEPTION 'entitlement/admin helper EXECUTE grants are not as required';
  END IF;
END
$chk$;
