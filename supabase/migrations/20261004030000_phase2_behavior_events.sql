-- Zyntra Phase 2: event-first behavioural telemetry.
-- Raw events are candidate-owned telemetry. Derived intelligence remains server-owned.

CREATE TABLE IF NOT EXISTS public.behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'QUESTION_OPENED',
      'QUESTION_FIRST_INTERACTION',
      'ANSWER_SELECTED',
      'ANSWER_CHANGED',
      'CONFIDENCE_SET',
      'QUESTION_SUBMITTED',
      'SESSION_STARTED',
      'SESSION_RESUMED',
      'SESSION_COMPLETED',
      'SESSION_ABANDONED',
      'SESSION_PAUSED',
      'INTERVENTION_STARTED',
      'INTERVENTION_COMPLETED',
      'INTERVENTION_OUTCOME'
    )
  ),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sequence_no INTEGER,
  question_position INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_behavior_events_user_time
  ON public.behavior_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_session
  ON public.behavior_events (user_id, session_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_behavior_events_question
  ON public.behavior_events (user_id, question_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_type
  ON public.behavior_events (event_type, occurred_at DESC);

ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own behavior events" ON public.behavior_events;
CREATE POLICY "Users can view own behavior events"
  ON public.behavior_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own behavior events" ON public.behavior_events;
CREATE POLICY "Users can insert own behavior events"
  ON public.behavior_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Events are immutable telemetry. No browser UPDATE/DELETE.
REVOKE UPDATE, DELETE, TRUNCATE ON public.behavior_events FROM anon, authenticated;

-- Server-side analytics can read events through SECURITY DEFINER functions/service role.
NOTIFY pgrst, 'reload schema';


COMMENT ON TABLE public.behavior_events IS
  'Raw candidate behavioural telemetry. Client-writable, candidate-scoped and immutable; derived intelligence is server-owned.';

COMMENT ON COLUMN public.behavior_events.payload IS
  'Event-specific metadata only. Never store secrets, raw PII, or cross-user data.';
