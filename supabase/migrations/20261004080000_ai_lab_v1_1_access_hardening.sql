-- AI Lab V1.1 access hardening.
-- Defense-in-depth: explicitly remove public/client write access and keep credentials service-only.

REVOKE ALL ON public.ai_lab_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_lab_sessions FROM PUBLIC, anon;
REVOKE ALL ON public.ai_lab_events FROM PUBLIC, anon;

GRANT ALL ON public.ai_lab_connections TO service_role;
GRANT ALL ON public.ai_lab_sessions TO service_role;
GRANT ALL ON public.ai_lab_events TO service_role;

GRANT SELECT ON public.ai_lab_sessions TO authenticated;
GRANT SELECT ON public.ai_lab_events TO authenticated;

ALTER TABLE public.ai_lab_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_lab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_lab_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_lab_connections_service_only" ON public.ai_lab_connections;
CREATE POLICY "ai_lab_connections_service_only"
ON public.ai_lab_connections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "ai_lab_sessions_own_read" ON public.ai_lab_sessions;
CREATE POLICY "ai_lab_sessions_own_read"
ON public.ai_lab_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_lab_events_own_read" ON public.ai_lab_events;
CREATE POLICY "ai_lab_events_own_read"
ON public.ai_lab_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_lab_sessions_service_write" ON public.ai_lab_sessions;
CREATE POLICY "ai_lab_sessions_service_write"
ON public.ai_lab_sessions
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "ai_lab_sessions_service_update" ON public.ai_lab_sessions;
CREATE POLICY "ai_lab_sessions_service_update"
ON public.ai_lab_sessions
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "ai_lab_events_service_all" ON public.ai_lab_events;
CREATE POLICY "ai_lab_events_service_all"
ON public.ai_lab_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
