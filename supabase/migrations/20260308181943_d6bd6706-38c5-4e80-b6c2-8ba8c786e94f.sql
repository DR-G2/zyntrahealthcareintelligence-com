
CREATE TABLE public.user_legal_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.user_legal_acceptance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own acceptance" ON public.user_legal_acceptance
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own acceptance" ON public.user_legal_acceptance
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
