
-- admin_roles table
CREATE TABLE public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Seed admin roles
INSERT INTO public.admin_roles (email, role) VALUES
  ('gopalrock.naren@gmail.com', 'super_admin'),
  ('amc.osce.2026@gmail.com', 'admin'),
  ('testuser123@zyntr.website', 'admin');

-- admin_activity_logs table
CREATE TABLE public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  action_type text NOT NULL,
  target_user_id uuid,
  target_user_email text,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Add is_banned to profiles
ALTER TABLE public.profiles ADD COLUMN is_banned boolean NOT NULL DEFAULT false;
