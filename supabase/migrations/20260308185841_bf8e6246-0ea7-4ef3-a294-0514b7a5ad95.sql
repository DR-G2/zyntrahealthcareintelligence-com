
CREATE TABLE public.feed_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_text text NOT NULL,
  feed_type text NOT NULL DEFAULT 'mcq',
  subject text,
  generated_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feed submissions" ON public.feed_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feed submissions" ON public.feed_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own feed submissions" ON public.feed_submissions FOR DELETE USING (auth.uid() = user_id);
