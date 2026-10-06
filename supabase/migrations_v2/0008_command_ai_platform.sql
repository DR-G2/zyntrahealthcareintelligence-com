-- Phase 4 / 0008: command, AI Lab and platform/compliance
create table if not exists command.admin_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,role)
);

create table if not exists command.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_role text not null,
  action text not null,
  target_type text,
  target_id text,
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  correlation_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_actor_time_idx on command.admin_activity_logs(actor_user_id,created_at desc);
create index if not exists admin_activity_target_idx on command.admin_activity_logs(target_type,target_id);

create table if not exists command.manual_overrides (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  target_type text not null,
  target_id text not null,
  override_data jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists command.system_health_logs (
  id uuid primary key default gen_random_uuid(),
  component text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists command.system_error_logs (
  id uuid primary key default gen_random_uuid(),
  component text,
  error_type text,
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_lab.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  encrypted_api_key text not null,
  selected_model text,
  status text not null default 'active',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_lab.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  model text,
  mode text not null,
  prompt text,
  response_text text,
  status text not null default 'pending',
  error_code text,
  context_attached boolean not null default false,
  use_intelligence boolean not null default true,
  request_tokens integer,
  response_tokens integer,
  total_tokens integer,
  estimated_cost numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_lab.interactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references ai_lab.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  estimated_cost numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null,
  external_transaction_id text not null,
  amount numeric not null check (amount >= 0),
  currency text not null,
  product_key text,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,external_transaction_id)
);

create table if not exists public.user_legal_acceptance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_key text not null,
  document_version text not null,
  accepted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id,document_key,document_version)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,endpoint)
);

create table if not exists public.data_export_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null,
  status text not null,
  file_name text,
  error_message text,
  version integer not null default 1,
  snapshot_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
