-- Phase 4 / 0005: sessions and learning transactions
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_type text not null,
  status text not null default 'active' check (status in ('active','paused','completed','abandoned')),
  config jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at),
  check (status <> 'completed' or completed_at is not null)
);

create index if not exists practice_sessions_user_status_idx on public.practice_sessions(user_id,status);
create index if not exists practice_sessions_user_created_idx on public.practice_sessions(user_id,created_at desc);

create table if not exists public.practice_session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position integer not null check (position >= 0),
  presented_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(session_id,position)
);

create index if not exists practice_session_questions_question_idx on public.practice_session_questions(question_id);

create table if not exists public.user_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  session_id uuid references public.practice_sessions(id) on delete set null,
  selected_answer text not null,
  is_correct boolean not null,
  time_taken_seconds integer check (time_taken_seconds >= 0),
  confidence_level smallint check (confidence_level between 1 and 5),
  answer_changes_count integer not null default 0 check (answer_changes_count >= 0),
  time_to_first_click integer check (time_to_first_click >= 0),
  change_sequence jsonb,
  pause_events jsonb,
  time_of_day text,
  question_position integer check (question_position >= 0),
  previous_question_correct boolean,
  question_version integer check (question_version >= 1),
  app_version text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_attempts_user_created_idx on public.user_attempts(user_id,created_at desc);
create index if not exists user_attempts_user_question_idx on public.user_attempts(user_id,question_id,created_at desc);
create index if not exists user_attempts_session_idx on public.user_attempts(session_id);
create index if not exists user_attempts_question_idx on public.user_attempts(question_id);

create table if not exists public.station_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','paused','completed','abandoned')),
  config jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists public.station_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.station_sessions(id) on delete cascade,
  station_id uuid not null references public.clinical_stations(id) on delete restrict,
  position integer not null check (position >= 0),
  presented_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(session_id,position)
);

create table if not exists public.station_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  station_id uuid not null references public.clinical_stations(id) on delete restrict,
  session_id uuid references public.station_sessions(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  checklist_result jsonb,
  candidate_response jsonb,
  evaluation jsonb,
  score numeric,
  evaluator_type text,
  evaluator_version text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists station_attempts_user_created_idx on public.station_attempts(user_id,created_at desc);
create index if not exists station_attempts_station_idx on public.station_attempts(station_id);
