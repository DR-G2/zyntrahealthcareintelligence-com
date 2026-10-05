-- P4: AMC decision context.
create table if not exists public.amc_decision_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plugin_version_id uuid not null references public.amc_plugin_version(id) on delete restrict,
  environment_id uuid not null references public.amc_exam_environment(id) on delete restrict,
  decision_type text not null,
  source_dwig_id uuid,
  selected_task jsonb,
  uncertainty_before jsonb,
  uncertainty_after jsonb,
  decision_status text not null default 'PROPOSED',
  created_at timestamptz not null default now()
);
create index if not exists idx_amc_decision_user on public.amc_decision_context(user_id, created_at desc);
revoke all on public.amc_decision_context from anon, authenticated;
grant select, insert, update, delete on public.amc_decision_context to service_role;
alter table public.amc_decision_context enable row level security;
