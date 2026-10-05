-- PIE v1.0 P1.7: security invariants
-- This migration adds database-level guardrails only.
-- It does not change legacy intelligence behaviour.

CREATE OR REPLACE FUNCTION public.pie_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

REVOKE ALL ON FUNCTION public.pie_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pie_is_admin() TO authenticated, service_role;

-- PIE model/version metadata is readable by authenticated users, but writable
-- only by service_role.
-- Internal question parameters remain service-role only.
DROP POLICY IF EXISTS pie_model_version_authenticated_select ON public.pie_model_version;
CREATE POLICY pie_model_version_authenticated_select
  ON public.pie_model_version
  FOR SELECT TO authenticated
  USING (true);

-- Admin inspection is intentionally service-role-backed. No direct candidate
-- access is granted to internal dynamic, question, validation, or decision
-- records beyond their existing owner-safe policies.

COMMENT ON FUNCTION public.pie_is_admin() IS
  'PIE admin gate helper. Admin membership is derived from admin_roles and never from client-provided role data.';
