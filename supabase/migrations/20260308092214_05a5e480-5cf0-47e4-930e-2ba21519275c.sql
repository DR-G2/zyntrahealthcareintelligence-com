
-- Add new behavioral tracking columns to user_attempts
ALTER TABLE public.user_attempts ADD COLUMN IF NOT EXISTS time_to_first_click integer DEFAULT 0;
ALTER TABLE public.user_attempts ADD COLUMN IF NOT EXISTS change_sequence jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.user_attempts ADD COLUMN IF NOT EXISTS pause_events integer DEFAULT 0;
ALTER TABLE public.user_attempts ADD COLUMN IF NOT EXISTS time_of_day timestamptz DEFAULT now();
ALTER TABLE public.user_attempts ADD COLUMN IF NOT EXISTS question_position integer DEFAULT 0;
ALTER TABLE public.user_attempts ADD COLUMN IF NOT EXISTS previous_question_correct boolean;

-- Add difficulty_tier to questions
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS difficulty_tier integer;

-- Create question_difficulty_tiers table
CREATE TABLE IF NOT EXISTS public.question_difficulty_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
  tier integer NOT NULL DEFAULT 2,
  avg_time_seconds numeric DEFAULT 0,
  change_rate numeric DEFAULT 0,
  correct_rate numeric DEFAULT 0,
  sample_size integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.question_difficulty_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tiers"
  ON public.question_difficulty_tiers
  FOR SELECT
  TO authenticated
  USING (true);

-- Create behavior_profiles table
CREATE TABLE IF NOT EXISTS public.behavior_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  archetype text NOT NULL DEFAULT 'strategist',
  archetype_signals jsonb DEFAULT '{}'::jsonb,
  block_performance jsonb DEFAULT '{}'::jsonb,
  subject_patterns jsonb DEFAULT '{}'::jsonb,
  trap_flags jsonb DEFAULT '[]'::jsonb,
  predicted_score_low integer,
  predicted_score_high integer,
  predicted_score_potential integer,
  recommendations jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.behavior_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own behavior profile"
  ON public.behavior_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own behavior profile"
  ON public.behavior_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own behavior profile"
  ON public.behavior_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own behavior profile"
  ON public.behavior_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
