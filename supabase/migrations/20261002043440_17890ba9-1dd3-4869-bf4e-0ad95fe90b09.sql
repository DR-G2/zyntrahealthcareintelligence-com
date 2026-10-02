CREATE OR REPLACE FUNCTION public.has_paid_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.payments WHERE user_id = _user_id AND status = 'active')
      OR EXISTS (SELECT 1 FROM public.manual_overrides WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now()))
$$;
REVOKE EXECUTE ON FUNCTION public.has_paid_access(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_paid_access(uuid) TO authenticated;

DROP POLICY IF EXISTS "Questions are readable by everyone" ON public.questions;
DROP POLICY IF EXISTS "Questions are readable by authenticated users" ON public.questions;
REVOKE SELECT ON public.questions FROM anon;
CREATE POLICY "Paid users and admins can read questions" ON public.questions
FOR SELECT TO authenticated
USING (public.has_paid_access(auth.uid()) OR public.is_admin(auth.jwt() ->> 'email'));