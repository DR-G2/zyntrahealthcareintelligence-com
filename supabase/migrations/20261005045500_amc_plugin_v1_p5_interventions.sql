-- P5: AMC intervention catalogue and outcome linkage.
create table if not exists public.amc_intervention_catalog (
  id uuid primary key default gen_random_uuid(),
  plugin_version_id uuid not null references public.amc_plugin_version(id) on delete restrict,
  intervention_key text not null,
  target_dimension text not null,
  task_key text,
  description text not null,
  outcome_definition jsonb not null,
  active boolean not null default false,
  version text not null,
  unique(plugin_version_id, intervention_key, version)
);
create table if not exists public.amc_intervention_outcome (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  intervention_id uuid not null references public.amc_intervention_catalog(id) on delete restrict,
  pre_state jsonb,
  post_state jsonb,
  observed_outcome jsonb not null,
  causal_status text not null default 'OBSERVATIONAL',
  created_at timestamptz not null default now()
);
revoke all on public.amc_intervention_catalog from anon, authenticated;
revoke all on public.amc_intervention_outcome from anon, authenticated;
grant select, insert, update, delete on public.amc_intervention_catalog to service_role;
grant select, insert, update, delete on public.amc_intervention_outcome to service_role;
alter table public.amc_intervention_catalog enable row level security;
alter table public.amc_intervention_outcome enable row level security;
