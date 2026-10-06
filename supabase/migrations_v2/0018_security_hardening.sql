-- Zyntra V2 Phase 7 / security hardening before application cutover
-- No learner data exists yet, so tighten contracts before frontend migration.

-- 1. A learner may only attach an attempt to their own practice session.
create or replace function public.save_attempt(
  p_question_id uuid,
  p_session_id uuid,
  p_selected_answer text,
  p_is_correct boolean,
  p_time_taken_seconds integer default null,
  p_confidence_level smallint default null,
  p_answer_changes_count integer default 0,
  p_time_to_first_click integer default null,
  p_change_sequence jsonb default null,
  p_pause_events jsonb default null,
  p_time_of_day text default null,
  p_question_position integer default null,
  p_previous_question_correct boolean default null,
  p_question_version integer default null,
  p_app_version text default null,
  p_provenance jsonb default '{}'::jsonb
)
returns public.user_attempts
language plpgsql
security invoker
as $$
declare
  v_attempt public.user_attempts;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_session_id is not null
     and not exists (
       select 1
       from public.practice_sessions s
       where s.id = p_session_id
         and s.user_id = auth.uid()
     )
  then
    raise exception 'practice session does not belong to current user';
  end if;

  if p_confidence_level is not null and p_confidence_level not between 1 and 5 then
    raise exception 'confidence_level must be between 1 and 5';
  end if;

  insert into public.user_attempts (
    user_id, question_id, session_id, selected_answer, is_correct,
    time_taken_seconds, confidence_level, answer_changes_count,
    time_to_first_click, change_sequence, pause_events, time_of_day,
    question_position, previous_question_correct, question_version,
    app_version, provenance
  )
  values (
    auth.uid(), p_question_id, p_session_id, p_selected_answer, p_is_correct,
    p_time_taken_seconds, p_confidence_level, p_answer_changes_count,
    p_time_to_first_click, p_change_sequence, p_pause_events, p_time_of_day,
    p_question_position, p_previous_question_correct, p_question_version,
    p_app_version, coalesce(p_provenance,'{}'::jsonb)
  )
  returning * into v_attempt;

  return v_attempt;
end;
$$;

revoke all on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) from public;
grant execute on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) to authenticated;

-- 2. Prevent a signed-in user from asking whether an arbitrary UUID is an admin.
create or replace function command.is_admin(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = command, public, pg_temp
as $$
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    return false;
  end if;

  return exists (
    select 1
    from command.admin_roles ar
    where ar.user_id = coalesce(p_user_id,auth.uid())
      and ar.active = true
  );
end;
$$;

revoke all on function command.is_admin(uuid) from public;
grant execute on function command.is_admin(uuid) to authenticated;

-- 3. Learner-safe content views. Answers and examiner-only material never leave
-- the server-facing base tables.
create or replace view public.questions_for_learner
with (security_invoker = true)
as
select
  id, zyntra_id, subject_id, subtopic_id, stem, options,
  explanation, difficulty_tier, status, version, provenance,
  created_at, updated_at
from public.questions
where status = 'active';

create or replace view public.clinical_stations_for_learner
with (security_invoker = true)
as
select
  id, zyntra_id, subject, scenario_title, candidate_instructions,
  scenario_data, reading_time_minutes, station_time_minutes,
  status, version, provenance, created_at, updated_at
from public.clinical_stations
where status = 'active';

revoke all on public.questions from anon, authenticated;
revoke all on public.clinical_stations from anon, authenticated;

grant select on public.questions_for_learner to anon, authenticated;
grant select on public.clinical_stations_for_learner to anon, authenticated;

comment on view public.questions_for_learner is
  'Learner-safe question projection. Never exposes correct_answer.';
comment on view public.clinical_stations_for_learner is
  'Learner-safe station projection. Never exposes examiner instructions or marking checklist.';
