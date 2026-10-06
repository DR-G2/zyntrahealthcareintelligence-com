-- Phase 4 / 0004: canonical learning content
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  zyntra_id text unique,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  stem text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text,
  difficulty_tier text,
  status text not null default 'active' check (status in ('draft','active','retired','quarantined')),
  version integer not null default 1 check (version >= 1),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_subject_idx on public.questions(subject_id);
create index if not exists questions_subtopic_idx on public.questions(subtopic_id);
create index if not exists questions_status_idx on public.questions(status);
create index if not exists questions_difficulty_idx on public.questions(difficulty_tier);

create table if not exists public.clinical_stations (
  id uuid primary key default gen_random_uuid(),
  zyntra_id text unique,
  subject text not null,
  scenario_title text not null,
  candidate_instructions text,
  examiner_instructions text,
  marking_checklist jsonb,
  scenario_data jsonb not null default '{}'::jsonb,
  reading_time_minutes integer check (reading_time_minutes >= 0),
  station_time_minutes integer check (station_time_minutes > 0),
  status text not null default 'active' check (status in ('draft','active','retired','quarantined')),
  version integer not null default 1 check (version >= 1),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinical_stations_subject_idx on public.clinical_stations(subject);
create index if not exists clinical_stations_status_idx on public.clinical_stations(status);
