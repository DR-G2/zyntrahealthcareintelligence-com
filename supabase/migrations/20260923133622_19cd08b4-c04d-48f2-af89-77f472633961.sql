-- Secure admin-check helper (admin_roles has RLS with no policies, so a security-definer function is required)
CREATE OR REPLACE FUNCTION public.is_admin(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_roles WHERE email = _email)
$$;

-- 1) question-images storage: admin-only write/delete
DROP POLICY IF EXISTS "Authenticated users can delete question images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload question images" ON storage.objects;

CREATE POLICY "Admins can upload question images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'question-images' AND public.is_admin(auth.jwt() ->> 'email'));

CREATE POLICY "Admins can delete question images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'question-images' AND public.is_admin(auth.jwt() ->> 'email'));

-- 2) page_views: admin-only read (anonymous INSERT stays open — required for visitor tracking)
DROP POLICY IF EXISTS "Authenticated can select page views" ON public.page_views;
CREATE POLICY "Admins can read page views"
ON public.page_views FOR SELECT TO authenticated
USING (public.is_admin(auth.jwt() ->> 'email'));

-- 3) intent_signals: admin-only read (anonymous INSERT stays open — required for visitor tracking)
DROP POLICY IF EXISTS "Authenticated can select intent signals" ON public.intent_signals;
CREATE POLICY "Admins can read intent signals"
ON public.intent_signals FOR SELECT TO authenticated
USING (public.is_admin(auth.jwt() ->> 'email'));

-- 4) visitor_sessions + nudge_signals: admin-only read as well (same analytics family; anonymous INSERT stays open)
DROP POLICY IF EXISTS "Authenticated can select visitor sessions" ON public.visitor_sessions;
DROP POLICY IF EXISTS "Authenticated can read visitor sessions" ON public.visitor_sessions;
CREATE POLICY "Admins can read visitor sessions"
ON public.visitor_sessions FOR SELECT TO authenticated
USING (public.is_admin(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Authenticated can select nudge signals" ON public.nudge_signals;
DROP POLICY IF EXISTS "Authenticated can read nudge signals" ON public.nudge_signals;
CREATE POLICY "Admins can read nudge signals"
ON public.nudge_signals FOR SELECT TO authenticated
USING (public.is_admin(auth.jwt() ->> 'email'));