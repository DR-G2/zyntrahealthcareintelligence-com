-- P3: AMC exam adapter and readiness snapshots.
create table if not exists public.amc_readiness_snapshot (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plugin_version_id uuid not null references public.amc_plugin_version(id) on delete restrict,
  environment_id uuid not null references public.amc_exam_environment(id) on delete restrict,
  candidate_state_id uuid,
  target_definition jsonb not null,
  target_probability numeric,
  lower_bound numeric,
  upper_bound numeric,
  uncertainty numeric,
  evidence_summary jsonb not null default '{}'::jsonb,
  identification_status text not null default 'UNRESOLVED',
  readiness_status text not null default 'NOT_READY_FOR_INFERENCE',
  model_version text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_amc_ready_user on public.amc_readiness_snapshot(user_id, created_at desc);
create index if not exists idx_amc_ready_plugin on public.amc_readiness_snapshot(plugin_version_id, environment_id);
revoke all on public.amc_readiness_snapshot from anon, authenticated;
grant select, insert, update, delete on public.amc_readiness_snapshot to service_role;
alter table public.amc_readiness_snapshot enable row level security;
