
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS amc_candidate_id text;

CREATE TABLE IF NOT EXISTS public.system_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type text NOT NULL,
  user_email text,
  user_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
