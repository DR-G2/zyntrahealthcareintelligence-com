CREATE TABLE public.user_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  mcq_attempts integer NOT NULL DEFAULT 0,
  osce_attempts integer NOT NULL DEFAULT 0,
  ai_prompts_used integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.user_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage"
  ON public.user_usage_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON public.user_usage_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON public.user_usage_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);