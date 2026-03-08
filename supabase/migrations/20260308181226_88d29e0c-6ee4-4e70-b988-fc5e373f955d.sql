
-- User presence table for real-time tracking
CREATE TABLE public.user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_page text DEFAULT '/',
  is_online boolean DEFAULT true,
  last_seen_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Users can upsert their own presence
CREATE POLICY "Users can upsert own presence" ON public.user_presence
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- AI training context table
CREATE TABLE public.ai_training_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_training_context ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read training context (edge functions use service role anyway)
CREATE POLICY "Authenticated can read training context" ON public.ai_training_context
  FOR SELECT TO authenticated
  USING (true);
