DROP POLICY IF EXISTS "Authenticated can read training context" ON public.ai_training_context;
CREATE POLICY "Admins can read training context" ON public.ai_training_context FOR SELECT TO authenticated USING (public.is_admin(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Anon can update visitor sessions" ON public.visitor_sessions;
CREATE POLICY "Visitors can update their open session" ON public.visitor_sessions FOR UPDATE TO anon, authenticated
  USING (ended_at IS NULL AND started_at > now() - interval '1 day' AND (user_id IS NULL OR user_id = auth.uid()))
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anon can insert page views" ON public.page_views;
CREATE POLICY "Visitors can insert their own page views" ON public.page_views FOR INSERT TO anon, authenticated
  WITH CHECK ((user_id IS NULL OR user_id = auth.uid()) AND length(visitor_id) BETWEEN 1 AND 100 AND length(page) <= 500);

DROP POLICY IF EXISTS "Anon can insert intent signals" ON public.intent_signals;
CREATE POLICY "Visitors can insert their own intent signals" ON public.intent_signals FOR INSERT TO anon, authenticated
  WITH CHECK ((user_id IS NULL OR user_id = auth.uid()) AND length(visitor_id) BETWEEN 1 AND 100 AND length(action) <= 100 AND length(intent_level) <= 30);

DROP POLICY IF EXISTS "Anon can insert nudge signals" ON public.nudge_signals;
CREATE POLICY "Visitors can insert their own nudge signals" ON public.nudge_signals FOR INSERT TO anon, authenticated
  WITH CHECK ((user_id IS NULL OR user_id = auth.uid()) AND length(visitor_id) BETWEEN 1 AND 100 AND resolved_at IS NULL AND coalesce(length(message), 0) <= 2000);

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit a valid contact form" ON public.contact_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (length(name) BETWEEN 1 AND 200 AND length(email) BETWEEN 3 AND 320 AND email LIKE '%@%' AND length(category) <= 100 AND length(message) BETWEEN 1 AND 5000);

DROP POLICY IF EXISTS "Anyone can view question images" ON storage.objects;
CREATE POLICY "Admins can view question images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'question-images' AND public.is_admin(auth.jwt() ->> 'email'));