
CREATE TABLE public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL UNIQUE,
  session_type text NOT NULL DEFAULT 'mcq',
  config jsonb NOT NULL DEFAULT '{}',
  question_ids jsonb NOT NULL DEFAULT '[]',
  answers jsonb NOT NULL DEFAULT '{}',
  answer_changes jsonb NOT NULL DEFAULT '{}',
  change_sequences jsonb NOT NULL DEFAULT '{}',
  question_times jsonb NOT NULL DEFAULT '{}',
  time_to_first_click jsonb NOT NULL DEFAULT '{}',
  pause_events jsonb NOT NULL DEFAULT '{}',
  current_index integer NOT NULL DEFAULT 0,
  time_remaining integer NOT NULL DEFAULT 0,
  restored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON public.active_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
