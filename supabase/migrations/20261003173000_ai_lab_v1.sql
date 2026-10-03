-- AI Lab V1: per-user provider connection metadata and isolated sessions.
-- API credentials are encrypted server-side by the ai-lab Edge Function before persistence.
create table if not exists public.ai_lab_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai')),
  encrypted_api_key text not null,
  selected_model text,
  status text not null default 'connected' check (status in ('connected','error','disconnected')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create table if not exists public.ai_lab_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai')),
  model text,
  mode text not null check (mode in ('performance','questions','weak-area')),
  use_intelligence boolean not null default true,
  status text not null default 'completed' check (status in ('running','completed','error')),
  prompt text,
  response_text text,
  request_tokens integer,
  response_tokens integer,
  estimated_cost numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_lab_connections enable row level security;
alter table public.ai_lab_sessions enable row level security;

drop policy if exists "ai_lab_connections_service_only" on public.ai_lab_connections;
create policy "ai_lab_connections_service_only"
on public.ai_lab_connections
for all
to service_role
using (true)
with check (true);

drop policy if exists "ai_lab_sessions_own_read" on public.ai_lab_sessions;
create policy "ai_lab_sessions_own_read"
on public.ai_lab_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ai_lab_sessions_service_write" on public.ai_lab_sessions;
create policy "ai_lab_sessions_service_write"
on public.ai_lab_sessions
for insert
to service_role
with check (true);

drop policy if exists "ai_lab_sessions_service_update" on public.ai_lab_sessions;
create policy "ai_lab_sessions_service_update"
on public.ai_lab_sessions
for update
to service_role
using (true)
with check (true);

create index if not exists idx_ai_lab_sessions_user_created
on public.ai_lab_sessions(user_id, created_at desc);
