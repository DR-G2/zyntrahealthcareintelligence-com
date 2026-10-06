-- Phase 4 / 0007: raw telemetry and canonical intelligence
create table if not exists intelligence.behavior_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.practice_sessions(id) on delete set null,
  question_id uuid references public.questions(id) on delete set null,
  event_type text not null,
  event_version integer not null default 1 check (event_version >= 1),
  occurred_at timestamptz not null default now(),
  sequence_no integer check (sequence_no >= 0),
  question_position integer check (question_position >= 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists behavior_events_user_time_idx on intelligence.behavior_events(user_id,occurred_at desc);
create index if not exists behavior_events_session_sequence_idx on intelligence.behavior_events(session_id,sequence_no);
create index if not exists behavior_events_question_time_idx on intelligence.behavior_events(question_id,occurred_at desc);
create index if not exists behavior_events_type_idx on intelligence.behavior_events(event_type);

create table if not exists intelligence.question_dna (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  question_version integer not null check (question_version >= 1),
  dna_version integer not null check (dna_version >= 1),
  difficulty_score numeric,
  discrimination_score numeric,
  timing_profile jsonb not null default '{}'::jsonb,
  confidence_profile jsonb not null default '{}'::jsonb,
  stability_profile jsonb not null default '{}'::jsonb,
  ambiguity_flags jsonb not null default '{}'::jsonb,
  evidence_window jsonb not null default '{}'::jsonb,
  model_version text,
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(question_id,question_version)
);

create table if not exists intelligence.question_dna_history (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  question_version integer not null,
  dna_version integer not null,
  snapshot jsonb not null,
  model_version text,
  calculated_at timestamptz not null default now()
);

create index if not exists question_dna_history_question_idx on intelligence.question_dna_history(question_id,calculated_at desc);

create table if not exists intelligence.behavior_dna (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  archetype text,
  rush_index numeric,
  hesitation_index numeric,
  fatigue_index numeric,
  stability_metrics jsonb not null default '{}'::jsonb,
  evidence_window jsonb not null default '{}'::jsonb,
  model_version text,
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists intelligence.readiness_dna (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  readiness_score numeric,
  readiness_band text,
  dimensions jsonb not null default '{}'::jsonb,
  evidence_window jsonb not null default '{}'::jsonb,
  model_version text,
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists intelligence.subject_dna (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  accuracy numeric,
  timing_profile jsonb not null default '{}'::jsonb,
  confidence_profile jsonb not null default '{}'::jsonb,
  dimensions jsonb not null default '{}'::jsonb,
  evidence_window jsonb not null default '{}'::jsonb,
  model_version text,
  calculated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,subject_id)
);

create table if not exists intelligence.confidence_intelligence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  evidence_window jsonb not null default '{}'::jsonb,
  calibration_score numeric,
  overconfidence_score numeric,
  underconfidence_score numeric,
  stability_score numeric,
  dimensions jsonb not null default '{}'::jsonb,
  model_version text,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists confidence_intelligence_user_time_idx on intelligence.confidence_intelligence(user_id,calculated_at desc);

create table if not exists intelligence.ideal_candidate_profile (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version >= 1),
  name text not null,
  dimensions jsonb not null default '{}'::jsonb,
  weights jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists intelligence.intervention_catalog (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  definition jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists intelligence.candidate_interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  intervention_id uuid not null references intelligence.intervention_catalog(id) on delete restrict,
  status text not null default 'recommended' check (status in ('recommended','accepted','started','completed','dismissed','expired')),
  rationale jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_interventions_user_status_idx on intelligence.candidate_interventions(user_id,status);

create table if not exists intelligence.intervention_outcomes (
  id uuid primary key default gen_random_uuid(),
  candidate_intervention_id uuid not null references intelligence.candidate_interventions(id) on delete cascade,
  outcome jsonb not null default '{}'::jsonb,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists intelligence.intervention_effectiveness (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references intelligence.intervention_catalog(id) on delete cascade,
  evidence_window jsonb not null default '{}'::jsonb,
  effectiveness_score numeric,
  confidence_interval jsonb,
  model_version text,
  calculated_at timestamptz not null default now()
);

create table if not exists intelligence.next_best_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null,
  action_data jsonb not null default '{}'::jsonb,
  priority numeric,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists next_best_actions_user_priority_idx on intelligence.next_best_actions(user_id,priority desc);
