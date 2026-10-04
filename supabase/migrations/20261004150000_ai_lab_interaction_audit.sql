CREATE TABLE IF NOT EXISTS public.ai_lab_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.ai_lab_sessions(id) ON DELETE SET NULL,
  action text NOT NULL,
  provider text,
  model text,
  mode text,
  request_text text,
  response_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_lab_interactions_user_created
  ON public.ai_lab_interactions(user_id, created_at DESC);

ALTER TABLE public.ai_lab_interactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_lab_interactions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_lab_interactions TO service_role;
GRANT SELECT ON public.ai_lab_interactions TO authenticated;

DROP POLICY IF EXISTS "ai_lab_interactions_own_read" ON public.ai_lab_interactions;
CREATE POLICY "ai_lab_interactions_own_read"
ON public.ai_lab_interactions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_lab_interactions_service_all" ON public.ai_lab_interactions;
CREATE POLICY "ai_lab_interactions_service_all"
ON public.ai_lab_interactions
FOR ALL TO service_role
USING (true)
WITH CHECK (true);
