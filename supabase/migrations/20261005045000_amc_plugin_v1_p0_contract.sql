-- AMC Exam Intelligence Plugin v1
create table if not exists public.amc_plugin_version (
  id uuid primary key default gen_random_uuid(),
  plugin_key text not null,
  plugin_version text not null,
  exam_code text not null,
  status text not null default 'DEVELOPMENT' check (status in ('DEVELOPMENT','VALIDATING','CERTIFIED','ACTIVE','RETIRED','REJECTED')),
  contract_version text not null,
  source_policy text not null default 'versioned_configuration',
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  unique(plugin_key, plugin_version)
);
create table if not exists public.amc_exam_environment (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid not null references public.amc_plugin_version(id) on delete restrict,
  environment_key text not null,
  environment_version text not null,
  blueprint_version text not null,
  task_mix_version text not null,
  timing_version text not null,
  target_version text not null,
  exam_duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(plugin_version_id, environment_key, environment_version)
);
create table if not exists public.amc_blueprint_dimension (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.amc_exam_environment(id) on delete restrict,
  dimension_key text not null,
  parent_dimension_key text,
  label text not null,
  display_order integer not null default 0,
  weight numeric,
  weight_basis text,
  metadata jsonb not null default '{}'::jsonb,
  unique(environment_id, dimension_key)
);
create table if not exists public.amc_task_taxonomy (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid not null references public.amc_plugin_version(id) on delete restrict,
  task_key text not null,
  task_group text not null,
  label text not null,
  description text,
  version text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(plugin_version_id, task_key, version)
);
create index if not exists idx_amc_env_plugin on public.amc_exam_environment(plugin_version_id);
create index if not exists idx_amc_blueprint_env on public.amc_blueprint_dimension(environment_id);
create index if not exists idx_amc_task_plugin on public.amc_task_taxonomy(plugin_version_id);
revoke all on public.amc_plugin_version from anon, authenticated;
revoke all on public.amc_exam_environment from anon, authenticated;
revoke all on public.amc_blueprint_dimension from anon, authenticated;
revoke all on public.amc_task_taxonomy from anon, authenticated;
grant select, insert, update, delete on public.amc_plugin_version to service_role;
grant select, insert, update, delete on public.amc_exam_environment to service_role;
grant select, insert, update, delete on public.amc_blueprint_dimension to service_role;
grant select, insert, update, delete on public.amc_task_taxonomy to service_role;
alter table public.amc_plugin_version enable row level security;
alter table public.amc_exam_environment enable row level security;
alter table public.amc_blueprint_dimension enable row level security;
alter table public.amc_task_taxonomy enable row level security;
insert into public.amc_plugin_version(plugin_key, plugin_version, exam_code, contract_version)
values ('AMC_EXAM_INTELLIGENCE','1.0.0','AMC','1.0')
on conflict (plugin_key, plugin_version) do nothing;
