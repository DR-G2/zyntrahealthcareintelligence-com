CREATE TABLE public.user_program_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track text NOT NULL,
  stage integer NOT NULL DEFAULT 1,
  progress_pct numeric NOT NULL DEFAULT 0,
  unlocked boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, track, stage)
);

ALTER TABLE public.user_program_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress"
  ON public.user_program_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);