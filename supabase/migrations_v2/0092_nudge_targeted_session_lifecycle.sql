-- Nudge ↔ PIE targeted session lifecycle. Additive, review-only migration.
-- Candidate-facing targeting is based on get_my_nudge_target(), never shadow inference.
-- Does not replace save_attempt, pie.decide, pie_next_question, or the P12 inference path.

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
  v_last timestamptz;
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

  -- Reuse the existing per-user creation throttle and active-session ceiling.
  insert into pie.session_create_throttle(user_id, last_created_at, create_count)
  values (v_user, '-infinity'::timestamptz, 0)
  on conflict (user_id) do nothing;
  select last_created_at into v_last
    from pie.session_create_throttle where user_id = v_user for update;
  if v_last > clock_timestamp() - interval '30 seconds' then
    raise exception 'PIE_RATE_LIMITED: one session per 30 seconds' using errcode = '53400';
  end if;
  if (
    select count(*) from pie.adaptive_session a
    join public.practice_sessions ps on ps.id = a.session_id
    where a.user_id = v_user and ps.status = 'active'
  ) >= 3 then
    raise exception 'PIE_TOO_MANY_ACTIVE_SESSIONS' using errcode = '53400';
  end if;
  update pie.session_create_throttle
    set last_created_at = clock_timestamp(), create_count = create_count + 1
    where user_id = v_user;

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

  insert into pie.adaptive_session(session_id, user_id, policy_version, blueprint_key)
  values (v_session, v_user, 'nudge-gap-v1', 'AMC_CAT_MCQ');

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

-- Only return reassessment metrics for an LO that this learner actually targeted in Nudge.
create or replace function public.get_my_nudge_progress(p_lo_id uuid)
returns table(
  status text,
  attempt_count integer,
  distinct_question_count integer,
  correct_count integer,
  accuracy numeric
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.practice_sessions ps
    where ps.user_id = v_user
      and ps.status = 'completed'
      and ps.config->>'selector' = 'nudge-gap-v1'
      and ps.config->>'nudge_lo_id' = p_lo_id::text
  ) then
    raise exception 'NUDGE_TARGET_NOT_FOUND: no completed Nudge session for this objective' using errcode = '42501';
  end if;

  return query
  select 'READY'::text,
    count(*)::integer,
    count(distinct ua.question_id)::integer,
    count(*) filter (where ua.is_correct)::integer,
    avg(case when ua.is_correct then 1.0 else 0.0 end)::numeric
  from public.user_attempts ua
  join pie.question_lo ql on ql.question_id = ua.question_id and ql.is_primary
  where ua.user_id = v_user and ql.lo_id = p_lo_id;
end
$function$;

revoke all on function public.get_my_nudge_progress(uuid) from public, anon;
grant execute on function public.get_my_nudge_progress(uuid) to authenticated, service_role;
