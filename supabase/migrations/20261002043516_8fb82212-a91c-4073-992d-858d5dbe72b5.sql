DROP POLICY IF EXISTS "Paid users and admins can read questions" ON public.questions;
DROP FUNCTION IF EXISTS public.has_paid_access(uuid);
CREATE OR REPLACE FUNCTION public.current_user_can_read_questions()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.payments WHERE user_id = auth.uid() AND status = 'active')
    OR EXISTS (SELECT 1 FROM public.manual_overrides WHERE user_id = auth.uid() AND (expires_at IS NULL OR expires_at > now()))
    OR EXISTS (SELECT 1 FROM public.admin_roles WHERE email = auth.jwt() ->> 'email')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_can_read_questions() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.current_user_can_read_questions() TO authenticated;
CREATE POLICY "Paid users and admins can read questions" ON public.questions
FOR SELECT TO authenticated USING (public.current_user_can_read_questions());