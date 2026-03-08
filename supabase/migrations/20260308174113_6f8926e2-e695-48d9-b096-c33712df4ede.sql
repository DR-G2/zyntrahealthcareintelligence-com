CREATE TABLE public.manual_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'full_access',
  granted_by text,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

ALTER TABLE public.manual_overrides ENABLE ROW LEVEL SECURITY;

-- No public RLS policies — only service role can access
