-- P6: AMC outcome and learning loop.
create table if not exists public.amc_intervention_outcome_event (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plugin_version_id uuid not null references public.amc_plugin_version(id) on delete restrict,
  environment_id uuid not null references public.amc_exam_environment(id) on delete restrict,
  intervention_id uuid references public.amc_intervention_catalog(id) on delete restrict,
  action_type text not null check (action_type in ('QUESTION','TASK','INTERVENTION')),
  outcome_definition jsonb not null,
  observed_outcome jsonb not null,
  pre_uncertainty jsonb,
  post_uncertainty jsonb,
  state_update_reference uuid,
  causal_status text not null default 'OBSERVATIONAL',
  created_at timestamptz not null default now()
);
create index if not exists idx_amc_outcome_user on public.amc_intervention_outcome_event(user_id, created_at desc);
create index if not exists idx_amc_outcome_plugin on public.amc_intervention_outcome_event(plugin_version_id, environment_id);
revoke all on public.amc_intervention_outcome_event from anon, authenticated;
grant select, insert, update, delete on public.amc_intervention_outcome_event to service_role;
alter table public.amc_intervention_outcome_event enable row level security;

create table if not exists public.amc_learning_update (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plugin_version_id uuid not null references public.amc_plugin_version(id) on delete restrict,
  source_outcome_id uuid not null references public.amc_intervention_outcome_event(id) on delete restrict,
  update_type text not null check (update_type in ('OBSERVATION_ONLY','PIE_STATE_UPDATE','INTERVENTION_EFFECT_ESTIMATE')),
  evidence jsonb not null default '{}'::jsonb,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_amc_learning_user on public.amc_learning_update(user_id, created_at desc);
revoke all on public.amc_learning_update from anon, authenticated;
grant select, insert, update, delete on public.amc_learning_update to service_role;
alter table public.amc_learning_update enable row level security;
