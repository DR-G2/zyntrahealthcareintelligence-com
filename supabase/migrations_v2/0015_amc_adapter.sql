-- Zyntra V2 Phase 5 / AMC adapter
create schema if not exists amc;

create table if not exists amc.amc_plugin_version (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  status text not null default 'draft' check (status in ('draft','shadow','active','retired')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists amc.amc_blueprint (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid references amc.amc_plugin_version(id) on delete cascade,
  blueprint_key text not null,
  version text not null,
  content jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  unique(blueprint_key,version)
);

create table if not exists amc.amc_task_taxonomy (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid references amc.amc_plugin_version(id) on delete cascade,
  task_key text not null,
  label text not null,
  definition jsonb not null default '{}'::jsonb,
  unique(plugin_version_id,task_key)
);

create table if not exists amc.amc_question_context (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  plugin_version_id uuid references amc.amc_plugin_version(id) on delete set null,
  task_key text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(question_id,plugin_version_id)
);

create table if not exists amc.amc_exam_environment (
  id uuid primary key default gen_random_uuid(),
  exam_key text not null,
  version text not null,
  environment jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  unique(exam_key,version)
);

create table if not exists amc.amc_adapter_evaluation (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid references amc.amc_plugin_version(id) on delete cascade,
  evaluation jsonb not null default '{}'::jsonb,
  score numeric,
  created_at timestamptz not null default now()
);

create table if not exists amc.amc_dwig_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  plugin_version_id uuid references amc.amc_plugin_version(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists amc.amc_intervention_catalog (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid references amc.amc_plugin_version(id) on delete cascade,
  intervention_key text not null,
  definition jsonb not null default '{}'::jsonb,
  unique(plugin_version_id,intervention_key)
);

create table if not exists amc.amc_validation_run (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid references amc.amc_plugin_version(id) on delete set null,
  status text not null default 'started' check (status in ('started','completed','failed')),
  dataset_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists amc.amc_validation_metric (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references amc.amc_validation_run(id) on delete cascade,
  metric_key text not null,
  metric_value numeric,
  details jsonb not null default '{}'::jsonb,
  unique(validation_run_id,metric_key)
);

create table if not exists amc.amc_validation_claim (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references amc.amc_validation_run(id) on delete cascade,
  claim text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'unverified' check (status in ('unverified','supported','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists amc.amc_certification_gate (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid references amc.amc_plugin_version(id) on delete set null,
  gate_key text not null,
  status text not null default 'pending' check (status in ('pending','passed','failed','revoked')),
  evidence jsonb not null default '{}'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  unique(plugin_version_id,gate_key)
);

create index if not exists amc_question_context_question_idx on amc.amc_question_context(question_id);
create index if not exists amc_dwig_context_user_idx on amc.amc_dwig_context(user_id,created_at desc);
