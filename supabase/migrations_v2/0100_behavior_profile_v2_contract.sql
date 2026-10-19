-- 0100: Additive V2 Behaviour profile contract.
-- Learner reads are owner-scoped; only the trusted Edge Function writes profiles.
-- This does not repurpose intelligence.behavior_dna or alter inference formulas.
begin;

create table if not exists intelligence.behavior_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_mode text not null check (session_mode = 'normal_mcq'),
  evidence_count integer not null check (evidence_count > 0),
  archetype text not null check (archetype in ('panic_changer','rusher','paralyzer','strategist','fatigue_victim','subject_avoider','unavailable')),
  archetype_signals jsonb not null default '{}'::jsonb,
  block_performance jsonb not null default '{}'::jsonb,
  subject_patterns jsonb not null default '{}'::jsonb,
  trap_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(trap_flags) = 'array'),
  recommendations jsonb not null default '[]'::jsonb check (jsonb_typeof(recommendations) = 'array'),
  predicted_score_low numeric,
  predicted_score_high numeric,
  predicted_score_potential numeric,
  model_version text not null default 'behavior-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table intelligence.behavior_profiles enable row level security;
drop policy if exists behavior_profiles_select_own on intelligence.behavior_profiles;
create policy behavior_profiles_select_own
  on intelligence.behavior_profiles for select to authenticated
  using (user_id = auth.uid());

grant usage on schema intelligence to authenticated, service_role;
grant usage on schema command to service_role;
grant select on command.manual_overrides to service_role;
revoke all on intelligence.behavior_profiles from public, anon;
grant select on intelligence.behavior_profiles to authenticated;
grant select, insert, update on intelligence.behavior_profiles to service_role;

create or replace view public.my_behavior_profile
with (security_invoker = true)
as
select user_id, session_mode, evidence_count, archetype, archetype_signals,
       block_performance, subject_patterns, trap_flags, recommendations,
       predicted_score_low, predicted_score_high, predicted_score_potential,
       model_version, created_at, updated_at
from intelligence.behavior_profiles
where user_id = auth.uid();

revoke all on public.my_behavior_profile from public, anon;
grant select on public.my_behavior_profile to authenticated;

notify pgrst, 'reload schema';
commit;
