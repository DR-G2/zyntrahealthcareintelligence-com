-- Zyntra V2 Phase 5 / PIE core
create table if not exists pie.pie_model_version (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  version text not null,
  status text not null default 'draft' check (status in ('draft','shadow','active','retired')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(model_key,version)
);

create table if not exists pie.pie_observation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  attempt_id uuid references public.user_attempts(id) on delete set null,
  event_id uuid references intelligence.behavior_events(id) on delete set null,
  observation_type text not null,
  observed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pie_observation_user_time_idx on pie.pie_observation(user_id,observed_at desc);
create index if not exists pie_observation_attempt_idx on pie.pie_observation(attempt_id);

create table if not exists pie.pie_inference_run (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  trigger_type text not null,
  input_window jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  status text not null default 'started' check (status in ('started','completed','failed','cancelled')),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pie_inference_user_time_idx on pie.pie_inference_run(user_id,started_at desc);

create table if not exists pie.pie_candidate_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  state_version integer not null default 1 check (state_version >= 1),
  state jsonb not null default '{}'::jsonb,
  confidence numeric,
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  source_inference_id uuid references pie.pie_inference_run(id) on delete set null,
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pie.pie_state_uncertainty (
  id uuid primary key default gen_random_uuid(),
  candidate_state_id uuid not null references pie.pie_candidate_state(id) on delete cascade,
  dimension text not null,
  uncertainty numeric,
  interval jsonb,
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  calculated_at timestamptz not null default now(),
  unique(candidate_state_id,dimension)
);

create table if not exists pie.pie_dynamic_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  state_key text not null,
  value jsonb not null default '{}'::jsonb,
  confidence numeric,
  observed_at timestamptz not null default now(),
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  unique(user_id,state_key)
);

create table if not exists pie.pie_dynamic_observation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  state_key text not null,
  value jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  source text,
  provenance jsonb not null default '{}'::jsonb
);

create index if not exists pie_dynamic_observation_user_time_idx on pie.pie_dynamic_observation(user_id,observed_at desc);

create table if not exists pie.pie_question_state (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  question_version integer not null,
  state jsonb not null default '{}'::jsonb,
  confidence numeric,
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(question_id,question_version)
);

create table if not exists pie.pie_question_uncertainty (
  id uuid primary key default gen_random_uuid(),
  question_state_id uuid not null references pie.pie_question_state(id) on delete cascade,
  dimension text not null,
  uncertainty numeric,
  interval jsonb,
  unique(question_state_id,dimension)
);

create table if not exists pie.pie_identifiability (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  dimension text not null,
  identifiability_score numeric,
  evidence jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create table if not exists pie.pie_hypothesis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  hypothesis_key text not null,
  hypothesis jsonb not null default '{}'::jsonb,
  probability numeric,
  status text not null default 'active' check (status in ('active','accepted','rejected','expired')),
  model_version_id uuid references pie.pie_model_version(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pie.pie_question_quarantine (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reason text not null,
  severity text not null default 'review' check (severity in ('review','high','critical')),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewed','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);