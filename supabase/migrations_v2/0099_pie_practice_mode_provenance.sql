-- 0099: Explicit V2 MCQ practice-mode provenance.
-- Adds a mode-aware session creator without changing PIE selection or inference formulas.
-- Ambiguous historical sessions remain unclassified; no historical mode is guessed.
begin;

do $$
begin
  if to_regprocedure('public.pie_create_session(integer,text,text)') is null then
    raise exception '0099 preflight: deployed PIE session creator is missing';
  end if;
  if to_regclass('public.practice_sessions') is null
     or to_regclass('public.user_attempts') is null
     or to_regclass('pie.pie_observation') is null then
    raise exception '0099 preflight: required V2 evidence tables are missing';
  end if;
end $$;

create or replace function public.pie_create_practice_session(
  p_count integer default 10,
  p_practice_mode text default 'normal_mcq'
)
returns table(session_id uuid, question_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_practice_mode not in ('normal_mcq', 'mock_practice') then
    raise exception 'Invalid MCQ practice mode' using errcode = '22023';
  end if;

  -- Keep the deployed server selector, question limits, and question-key boundary.
  -- The extra metadata is written in the same transaction as session creation.
  select created.session_id, created.question_count
    into v_session, v_count
  from public.pie_create_session(p_count, 'AMC_CAT_MCQ', 'pie_adaptive') created;

  update public.practice_sessions
     set config = config || jsonb_build_object('practice_mode', p_practice_mode)
   where id = v_session
     and user_id = v_uid
     and status = 'active'
     and session_type = 'pie_adaptive';

  if not found then
    raise exception 'Practice session mode could not be recorded' using errcode = 'P0002';
  end if;

  return query select v_session, v_count;
end;
$$;

revoke all on function public.pie_create_practice_session(integer,text) from public, anon;
grant execute on function public.pie_create_practice_session(integer,text) to authenticated, service_role;

create or replace function pie._tag_observation_practice_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
begin
  if new.attempt_id is null then
    return new;
  end if;

  select coalesce(ps.config ->> 'practice_mode',
                  case when ps.config ->> 'mode' = 'nudge' then 'nudge' else null end)
    into v_mode
  from public.user_attempts ua
  join public.practice_sessions ps
    on ps.id = ua.session_id
   and ps.user_id = ua.user_id
  where ua.id = new.attempt_id
    and ua.user_id = new.user_id;

  -- Unknown / legacy labels stay unknown. In particular, never map pie_adaptive to Normal MCQ.
  if v_mode in ('normal_mcq', 'mock_practice', 'amc_exam', 'nudge') then
    new.provenance := coalesce(new.provenance, '{}'::jsonb)
      || jsonb_build_object('practice_mode', v_mode);
    new.payload := coalesce(new.payload, '{}'::jsonb)
      || jsonb_build_object('practice_mode', v_mode);
  end if;
  return new;
end;
$$;

revoke all on function pie._tag_observation_practice_mode() from public, anon, authenticated, service_role;
drop trigger if exists pie_observation_practice_mode_provenance on pie.pie_observation;
create trigger pie_observation_practice_mode_provenance
before insert or update of payload, provenance, attempt_id on pie.pie_observation
for each row execute function pie._tag_observation_practice_mode();

create or replace function public.get_my_attempt_history(
  p_limit integer default 1000,
  p_before timestamptz default null,
  p_before_attempt_id uuid default null
)
returns table (
  attempt_id uuid,
  session_id uuid,
  session_mode text,
  question_id uuid,
  zyntra_id text,
  stem text,
  options jsonb,
  subject_id uuid,
  subject_name text,
  subtopic_id uuid,
  subtopic_name text,
  difficulty_tier text,
  lo_id uuid,
  lo_title text,
  concept_title text,
  selected_answer text,
  is_correct boolean,
  correct_answer text,
  explanation text,
  confidence_level smallint,
  time_taken_seconds integer,
  time_to_first_click integer,
  answer_changes_count integer,
  change_sequence jsonb,
  question_position integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'p_limit must be 1..5000' using errcode = '22023';
  end if;

  if (p_before is null) <> (p_before_attempt_id is null) then
    raise exception 'Both history cursor fields must be provided together'
      using errcode = '22023';
  end if;

  return query
  select
    ua.id,
    ua.session_id,
    coalesce(ps.config ->> 'practice_mode', ps.config ->> 'mode', ps.session_type, 'legacy_orphan'),
    q.id,
    q.zyntra_id,
    q.stem,
    q.options,
    q.subject_id,
    s.name,
    q.subtopic_id,
    st.name,
    q.difficulty_tier,
    lo.id,
    lo.title,
    c.title,
    ua.selected_answer,
    ua.is_correct,
    case when ps.status = 'completed' then q.correct_answer else null end,
    case when ps.status = 'completed' then q.explanation else null end,
    ua.confidence_level,
    ua.time_taken_seconds,
    ua.time_to_first_click,
    ua.answer_changes_count,
    ua.change_sequence,
    ua.question_position,
    ua.created_at
  from public.user_attempts ua
  left join public.practice_sessions ps
    on ps.id = ua.session_id
   and ps.user_id = v_uid
  join public.questions q
    on q.id = ua.question_id
  left join public.subjects s
    on s.id = q.subject_id
  left join public.subtopics st
    on st.id = q.subtopic_id
  left join pie.question_lo ql
    on ql.question_id = q.id
   and ql.is_primary
  left join pie.learning_objective lo
    on lo.id = ql.lo_id
  left join pie.concept c
    on c.id = lo.concept_id
  where ua.user_id = v_uid
    and (ua.session_id is null or ps.id is not null)
    and (
      p_before is null
      or ua.created_at < p_before
      or (
        ua.created_at = p_before
        and p_before_attempt_id is not null
        and ua.id < p_before_attempt_id
      )
    )
  order by ua.created_at desc, ua.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_my_attempt_history(integer, timestamptz, uuid)
  from public, anon;
grant execute on function public.get_my_attempt_history(integer, timestamptz, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';


notify pgrst, 'reload schema';
commit;
