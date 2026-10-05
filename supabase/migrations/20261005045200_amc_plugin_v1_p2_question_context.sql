-- P2: AMC question intelligence context.
create table if not exists public.amc_question_context (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  plugin_version_id uuid not null references public.amc_plugin_version(id) on delete restrict,
  environment_key text not null,
  blueprint_dimension_key text,
  task_key text,
  system_key text,
  clinical_domain_key text,
  question_family_key text,
  cognitive_demand_key text,
  novelty_class text,
  relevance_status text not null default 'UNREVIEWED',
  content_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(question_id, plugin_version_id, content_version)
);
create index if not exists idx_amc_qc_question on public.amc_question_context(question_id);
create index if not exists idx_amc_qc_blueprint on public.amc_question_context(plugin_version_id, blueprint_dimension_key);
revoke all on public.amc_question_context from anon, authenticated;
grant select, insert, update, delete on public.amc_question_context to service_role;
alter table public.amc_question_context enable row level security;
