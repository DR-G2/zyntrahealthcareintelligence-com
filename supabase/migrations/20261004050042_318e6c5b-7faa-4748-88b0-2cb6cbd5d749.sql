GRANT ALL ON public.ai_lab_connections TO service_role;
REVOKE ALL ON public.ai_lab_connections FROM anon, authenticated;
GRANT ALL ON public.ai_lab_sessions TO service_role;
GRANT SELECT ON public.ai_lab_sessions TO authenticated;
REVOKE ALL ON public.ai_lab_sessions FROM anon;

ALTER TABLE public.ai_lab_sessions ALTER COLUMN use_intelligence SET DEFAULT false;
ALTER TABLE public.ai_lab_sessions
  ADD COLUMN IF NOT EXISTS total_tokens integer,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS context_attached boolean NOT NULL DEFAULT false;

CREATE TABLE public.ai_lab_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.ai_lab_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('session_started','question_generated','question_started','answer_submitted','answer_changed','hint_requested','explanation_requested','session_completed')),
  provider text,
  model text,
  mode text,
  subject text,
  duration_ms integer,
  confidence integer CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  answer_changes integer,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_lab_events TO service_role;
GRANT SELECT ON public.ai_lab_events TO authenticated;
ALTER TABLE public.ai_lab_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_lab_events_own_read" ON public.ai_lab_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_lab_events_service_all" ON public.ai_lab_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_ai_lab_events_user_created ON public.ai_lab_events(user_id, created_at DESC);
CREATE INDEX idx_ai_lab_events_session ON public.ai_lab_events(session_id);