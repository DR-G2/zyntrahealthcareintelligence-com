-- Nudge cold-start progression: mixed practice until 50 valid saved LO-mapped interactions,
-- then PIE-guided targeting only when supported evidence and eligible unseen questions exist.
-- Additive override; does not alter save_attempt or the protected P12 inference path.

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
  v_pos integer := 0;
  v_question record;
  v_mapped_interactions integer := 0;
  v_cold_start boolean := true;
  v_reason text := 'COLD_START_FIRST_50';
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_count is null or p_count < 3 or p_count > 20 then
    raise exception 'NUDGE_COUNT_INVALID: count must be between 3 and 20' using errcode = '22023';
  end if;

  select count(*)::integer into v_mapped_interactions
  from public.user_attempts ua
  join public.questions q on q.id = ua.question_id and q.status = 'active'
  join pie.question_lo ql on ql.question_id = q.id and ql.is_primary
  join pie.learning_objective lo on lo.id = ql.lo_id and lo.status = 'active'
  where ua.user_id = v_user;

  select * into v_target from public.get_my_nudge_target();
  if v_mapped_interactions >= 50 then
    if v_target.status = 'READY' and v_target.eligible_question_count >= 3 then
      v_cold_start := false;
      v_reason := v_target.reason_code;
    else
      v_reason := 'MIXED_PRACTICE_NO_SUPPORTED_TARGET';
    end if;
  end if;

  if (
    select count(*) from public.practice_sessions ps
    where ps.user_id = v_user
      and ps.status = 'active'
      and ps.session_type = 'pie_adaptive'
      and ps.config->>'mode' = 'nudge'
  ) >= 3 then
    raise exception 'PIE_TOO_MANY_ACTIVE_SESSIONS' using errcode = '53400';
  end if;

  insert into public.practice_sessions(
    user_id, session_type, status, config, started_at, last_activity_at
  )
  values (
    v_user, 'pie_adaptive', 'active',
    jsonb_build_object(
      'selector', case when v_cold_start then 'nudge-cold-start-v1' else 'nudge-gap-v1' end,
      'mode', 'nudge',
      'target_length', p_count,
      'nudge_stage', case
        when v_mapped_interactions < 50 then 'evidence_building'
        when v_cold_start then 'mixed_fallback'
        else 'pie_targeted'
      end,
      'mapped_interactions_at_start', v_mapped_interactions,
      'nudge_lo_id', case when v_cold_start then null else v_target.lo_id end,
      'nudge_lo_key', case when v_cold_start then null else v_target.lo_key end,
      'nudge_reason_code', v_reason
    ),
    now(), now()
  )
  returning id into v_session;

  if v_cold_start then
    for v_question in
      select q.id
      from public.questions q
      join pie.question_lo ql on ql.question_id = q.id and ql.is_primary
      join pie.learning_objective lo on lo.id = ql.lo_id and lo.status = 'active'
      where q.status = 'active'
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
      order by
        case when exists (
          select 1 from public.user_attempts ua
          where ua.user_id = v_user and ua.question_id = q.id
        ) then 1 else 0 end,
        random()
      limit p_count
    loop
      insert into public.practice_session_questions(session_id, question_id, position, presented_at)
      values (v_session, v_question.id, v_pos, now());
      v_pos := v_pos + 1;
    end loop;
  else
    for v_question in
      select q.id
      from public.questions q
      join pie.question_lo ql on ql.question_id = q.id and ql.is_primary
      where ql.lo_id = v_target.lo_id
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
      order by random()
      limit least(p_count, v_target.eligible_question_count)
    loop
      insert into public.practice_session_questions(session_id, question_id, position, presented_at)
      values (v_session, v_question.id, v_pos, now());
      v_pos := v_pos + 1;
    end loop;
  end if;

  if v_pos < 3 then
    raise exception 'NUDGE_NO_ELIGIBLE_QUESTIONS: fewer than three eligible questions remain' using errcode = 'P0002';
  end if;

  update public.practice_sessions
    set config = config || jsonb_build_object('target_length', v_pos)
    where id = v_session and user_id = v_user;

  if v_cold_start then
    return query select v_session, v_pos, null::uuid, 'MIXED_PRACTICE'::text,
      'Mixed practice · building your PIE evidence'::text, null::numeric,
      v_mapped_interactions, v_reason;
  else
    return query select v_session, v_pos, v_target.lo_id, v_target.lo_key, v_target.lo_title,
      v_target.accuracy, v_target.distinct_question_count, v_reason;
  end if;
end
$function$;

revoke all on function public.create_my_nudge_session(integer) from public, anon;
grant execute on function public.create_my_nudge_session(integer) to authenticated, service_role;
