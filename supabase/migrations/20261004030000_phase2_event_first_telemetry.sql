-- Zyntra Phase 2: event-first behavioural telemetry.
-- Raw telemetry is candidate-owned. Derived intelligence remains server-owned.

CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  question_id uuid NULL REFERENCES public.questions(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'QUESTION_OPENED',
    'QUESTION_FIRST_INTERACTION',
    'ANSWER_SELECTED',
    'ANSWER_CHANGED',
    'CONFIDENCE_SET',
    'QUESTION_SUBMITTED',
    'QUESTION_REVIEWED',
    'SESSION_STARTED',
    'SESSION_RESUMED',
    'SESSION_PAUSED',
    'SESSION_COMPLETED',
    'SESSION_ABANDONED',
    'INTERVENTION_STARTED',
    'INTERVENTION_COMPLETED',
    'INTERVENTION_OUTCOME'
  )),
  event_version integer NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  client_sequence integer NULL,
  question_position integer NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_user_time
  ON public.telemetry_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_user_session
  ON public.telemetry_events (user_id, session_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_question
  ON public.telemetry_events (question_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_type
  ON public.telemetry_events (event_type, occurred_at DESC);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own telemetry" ON public.telemetry_events;
CREATE POLICY "Users can insert own telemetry"
  ON public.telemetry_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own telemetry" ON public.telemetry_events;
CREATE POLICY "Users can read own telemetry"
  ON public.telemetry_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.telemetry_events FROM anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.telemetry_events TO authenticated;

COMMENT ON TABLE public.telemetry_events IS
  'Raw candidate behavioural telemetry. Client-writable, candidate-scoped; derived intelligence must be computed server-side.';

COMMENT ON COLUMN public.telemetry_events.payload IS
  'Event-specific metadata only. Never store secrets, raw PII, or cross-user data here.';

NOTIFY pgrst, 'reload schema';
