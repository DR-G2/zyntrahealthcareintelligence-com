-- Isolated PostgreSQL integration test for migration 0081.
-- Run from repository root against a disposable PostgreSQL database only.
\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create schema pie;

create function auth.uid() returns uuid
language sql stable
as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;

create table public.practice_sessions (
  id uuid primary key,
  user_id uuid not null,
  config jsonb,
  session_type text,
  status text
);
create table public.questions (
  id uuid primary key,
  zyntra_id text,
  stem text not null,
  options jsonb,
  subject_id uuid,
  subtopic_id uuid,
  difficulty_tier text,
  correct_answer text,
  explanation text
);
create table public.subjects (id uuid primary key, name text);
create table public.subtopics (id uuid primary key, name text);
create table public.user_attempts (
  id uuid primary key,
  user_id uuid not null,
  session_id uuid,
  question_id uuid not null,
  selected_answer text not null,
  is_correct boolean not null,
  confidence_level smallint,
  time_taken_seconds integer,
  time_to_first_click integer,
  answer_changes_count integer not null default 0,
  change_sequence jsonb,
  question_position integer,
  created_at timestamptz not null
);
create table pie.question_lo (question_id uuid not null, lo_id uuid not null, is_primary boolean not null default false);
create table pie.learning_objective (id uuid primary key, title text, concept_id uuid);
create table pie.concept (id uuid primary key, title text);

grant usage on schema public, auth, pie to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;

insert into public.subjects values ('10000000-0000-0000-0000-000000000001', 'Adult Medicine');
insert into public.subtopics values ('20000000-0000-0000-0000-000000000001', 'Cardiology');
insert into pie.concept values ('30000000-0000-0000-0000-000000000001', 'Clinical reasoning');
insert into pie.learning_objective values ('40000000-0000-0000-0000-000000000001', 'Assess chest pain', '30000000-0000-0000-0000-000000000001');

insert into public.questions values
('50000000-0000-0000-0000-000000000001', 'ZQ-A1', 'Question A1', '["A","B"]', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'moderate', 'A', 'Explanation A'),
('50000000-0000-0000-0000-000000000002', 'ZQ-A2', 'Question A2', '["A","B"]', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'moderate', 'B', 'Explanation B'),
('50000000-0000-0000-0000-000000000003', 'ZQ-B1', 'Question B1', '["A","B"]', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'moderate', 'A', 'Explanation private to B');

insert into pie.question_lo values
('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', true);

insert into public.practice_sessions values
('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '{"mode":"standard"}', 'standard', 'completed'),
('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '{"mode":"standard"}', 'in_progress', 'in_progress'),
('60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', '{"mode":"standard"}', 'standard', 'completed');

insert into public.user_attempts values
('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'A', true, 3, 30, 2, 0, '[]', 1, '2026-10-01T10:00:00Z'),
('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'A', false, 1, 40, 5, 1, '["B","A"]', 2, '2026-10-01T10:00:00Z'),
('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', null, '50000000-0000-0000-0000-000000000002', 'B', true, 2, 20, 1, 0, '[]', 3, '2026-10-01T09:00:00Z'),
('80000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 'A', true, 2, 20, 1, 0, '[]', 1, '2026-10-01T08:00:00Z');

-- Apply the exact migration under test. psql resolves this path from repo root.
\i supabase/migrations_v2/0081_v2_p5_history_rpc_schema_alignment.sql

set request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';
set role authenticated;

do $test$
declare
  n integer;
  leaked integer;
  unlocked integer;
  orphan integer;
  tied_order text[];
begin
  select count(*) into n from public.get_my_attempt_history(100, null, null);
  if n <> 3 then raise exception 'Expected 3 own attempts (including orphan, excluding other user), got %', n; end if;

  select count(*) into leaked
  from public.get_my_attempt_history(100, null, null)
  where attempt_id = '80000000-0000-0000-0000-000000000004';
  if leaked <> 0 then raise exception 'Cross-user session attempt leaked'; end if;

  select count(*) into unlocked
  from public.get_my_attempt_history(100, null, null)
  where attempt_id = '80000000-0000-0000-0000-000000000002'
    and (correct_answer is not null or explanation is not null);
  if unlocked <> 0 then raise exception 'Answer key leaked for incomplete session'; end if;

  select count(*) into n
  from public.get_my_attempt_history(100, null, null)
  where attempt_id = '80000000-0000-0000-0000-000000000001'
    and correct_answer = 'A' and explanation = 'Explanation A';
  if n <> 1 then raise exception 'Completed session answer key was not returned'; end if;

  begin
    perform * from public.get_my_attempt_history(0, null, null);
    raise exception 'Invalid limit unexpectedly accepted';
  exception when sqlstate '22023' then
    null;
  end;

  select count(*) into orphan
  from public.get_my_attempt_history(100, null, null)
  where attempt_id = '80000000-0000-0000-0000-000000000003'
    and correct_answer is null and explanation is null;
  if orphan <> 1 then raise exception 'Legacy orphan attempt missing or answer key exposed'; end if;

  select array_agg(attempt_id::text order by created_at desc, attempt_id desc) into tied_order
  from public.get_my_attempt_history(100, null, null)
  where created_at = '2026-10-01T10:00:00Z';
  if tied_order <> array[
    '80000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-000000000001'
  ]::text[] then raise exception 'Deterministic timestamp tie ordering failed: %', tied_order; end if;

  select count(*) into n
  from public.get_my_attempt_history(100, '2026-10-01T10:00:00Z', '80000000-0000-0000-0000-000000000002');
  if n <> 2 then raise exception 'Composite cursor expected 2 older rows, got %', n; end if;

  raise notice 'PASS 0081 isolated PostgreSQL integration: ownership, answer-key gating, legacy orphan, deterministic ordering, composite cursor';
end
$test$;

reset role;
set request.jwt.claim.sub = '70000000-0000-0000-0000-000000000002';
set role authenticated;

do $test_user_b$
declare
  n integer;
  correct_key text;
begin
  select count(*) into n from public.get_my_attempt_history(100, null, null);
  if n <> 1 then raise exception 'User B expected exactly their own attempt, got %', n; end if;

  select correct_answer into correct_key
  from public.get_my_attempt_history(100, null, null)
  where attempt_id = '80000000-0000-0000-0000-000000000004';
  if correct_key <> 'A' then raise exception 'User B completed-session answer key missing or wrong'; end if;

  raise notice 'PASS user B authenticated identity sees only own attempt and completed answer key';
end
$test_user_b$;
