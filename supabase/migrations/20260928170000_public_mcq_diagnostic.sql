create table if not exists public.public_mcq_diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  completed_at timestamptz,
  question_count integer not null default 0,
  used_question_ids uuid[] not null default '{}',
  result jsonb,
  lead_email text,
  lead_name text
);
create table if not exists public.public_mcq_diagnostic_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.public_mcq_diagnostic_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  position integer not null,
  selected_index integer not null,
  selected_answer text not null,
  is_correct boolean not null,
  confidence integer not null check (confidence between 1 and 4),
  time_to_first_selection_ms integer not null default 0,
  time_to_final_selection_ms integer not null default 0,
  answer_changes integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists public_mcd_attempts_session_idx on public.public_mcq_diagnostic_attempts(session_id, position);
create index if not exists public_mcd_attempts_question_idx on public.public_mcq_diagnostic_attempts(question_id);
alter table public.public_mcq_diagnostic_sessions enable row level security;
alter table public.public_mcq_diagnostic_attempts enable row level security;
revoke all on public.public_mcq_diagnostic_sessions from anon, authenticated;
revoke all on public.public_mcq_diagnostic_attempts from anon, authenticated;