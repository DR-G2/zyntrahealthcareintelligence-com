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

create table if not exists pie.practice_session_mode (
  session_id uuid primary key references public.practice_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_mode text not null check (practice_mode in ('normal_mcq','amc_exam','mock_practice','nudge','osce')),
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);
alter table pie.practice_session_mode enable row level security;
revoke all on pie.practice_session_mode from public, anon, authenticated, service_role;

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
  if p_practice_mode not in ('normal_mcq', 'amc_exam', 'mock_practice') then
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

  insert into pie.practice_session_mode(session_id, user_id, practice_mode)
  values (v_session, v_uid, p_practice_mode);

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

  select sm.practice_mode
    into v_mode
  from public.user_attempts ua
  join pie.practice_session_mode sm
    on sm.session_id = ua.session_id
   and sm.user_id = ua.user_id
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
    coalesce(sm.practice_mode, 'legacy_orphan'),
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
  left join pie.practice_session_mode sm
    on sm.session_id = ua.session_id
   and sm.user_id = ua.user_id
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

create or replace function public.create_my_nudge_session(p_count integer default 10)
returns table(
  session_id uuid,
  question_count integer,
  lo_id uuid,
  lo_key text,
  lo_title text,
  baseline_accuracy numeric,
  baseline_question_count integer,
  reason_code text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_target record;
  v_session uuid;
  v_count integer;
  v_pos integer := 0;
  v_question record;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_count is null or p_count < 3 or p_count > 20 then
    raise exception 'NUDGE_COUNT_INVALID: count must be between 3 and 20' using errcode = '22023';
  end if;

  select * into v_target from public.get_my_nudge_target();
  if v_target.status <> 'READY' then
    raise exception 'NUDGE_NOT_READY: %', v_target.reason_code using errcode = 'P0002',
      detail = jsonb_build_object('status', v_target.status, 'reason_code', v_target.reason_code)::text;
  end if;

  -- Enforce the existing active-session ceiling; this schema has no throttle table.
  if (
    select count(*) from public.practice_sessions ps
    where ps.user_id = v_user
      and ps.status = 'active'
      and ps.session_type = 'pie_adaptive'
      and ps.config->>'mode' = 'nudge'
  ) >= 3 then
    raise exception 'PIE_TOO_MANY_ACTIVE_SESSIONS' using errcode = '53400';
  end if;

  v_count := least(p_count, v_target.eligible_question_count);
  if v_count < 3 then
    raise exception 'NUDGE_NO_ELIGIBLE_QUESTIONS' using errcode = 'P0002';
  end if;

  insert into public.practice_sessions(
    user_id, session_type, status, config, started_at, last_activity_at
  )
  values (
    v_user, 'pie_adaptive', 'active',
    jsonb_build_object(
      'selector', 'nudge-gap-v1',
      'mode', 'nudge',
      'target_length', v_count,
      'nudge_lo_id', v_target.lo_id,
      'nudge_lo_key', v_target.lo_key,
      'nudge_reason_code', v_target.reason_code
    ),
    now(), now()
  )
  returning id into v_session;

  insert into pie.practice_session_mode(session_id, user_id, practice_mode)
  values (v_session, v_user, 'nudge');

  for v_question in
    select q.id
    from public.questions q
    join pie.question_lo ql on ql.question_id = q.id
    where ql.lo_id = v_target.lo_id
      and ql.is_primary
      and q.status = 'active'
      and not exists (
        select 1 from public.user_attempts ua
        where ua.user_id = v_user and ua.question_id = q.id
      )
      and not exists (
        select 1 from pie.pie_question_quarantine qq
        where qq.question_id = q.id and qq.status = 'open'
      )
      and exists (
        select 1
        from amc.amc_blueprint b
        join amc.amc_blueprint_lo bl on bl.blueprint_id = b.id
          and bl.lo_id = ql.lo_id and bl.eligible
        where b.blueprint_key = 'AMC_CAT_MCQ'
          and (b.effective_from is null or b.effective_from <= now())
          and (b.effective_to is null or b.effective_to > now())
      )
    order by md5(q.id::text || v_user::text || v_session::text)
    limit v_count
  loop
    insert into public.practice_session_questions(session_id, question_id, position, presented_at)
    values (v_session, v_question.id, v_pos, now());
    v_pos := v_pos + 1;
  end loop;

  if v_pos < 3 then
    raise exception 'NUDGE_NO_ELIGIBLE_QUESTIONS: fewer than three eligible questions remained' using errcode = 'P0002';
  end if;

  update public.practice_sessions
    set config = config || jsonb_build_object('target_length', v_pos)
    where id = v_session and user_id = v_user;

  return query select v_session, v_pos, v_target.lo_id, v_target.lo_key, v_target.lo_title,
    v_target.accuracy, v_target.distinct_question_count, v_target.reason_code;
end
$function$;

revoke all on function public.create_my_nudge_session(integer) from public, anon;
grant execute on function public.create_my_nudge_session(integer) to authenticated, service_role;


revoke all on function public.create_my_nudge_session(integer) from public, anon;
grant execute on function public.create_my_nudge_session(integer) to authenticated, service_role;

notify pgrst, 'reload schema';


notify pgrst, 'reload schema';
commit;
