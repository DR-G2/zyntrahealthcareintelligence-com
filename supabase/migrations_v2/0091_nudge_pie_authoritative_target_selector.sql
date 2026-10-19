-- Nudge target selector: current evidence-gated production definition.
-- Uses active saved attempts only, primary LO mappings, and active AMC blueprint eligibility.
-- Does not use shadow inference or modify the protected P12 inference path.
CREATE OR REPLACE FUNCTION public.get_my_nudge_target()
 RETURNS TABLE(status text, reason_code text, lo_id uuid, lo_key text, lo_title text, evidence_count integer, distinct_question_count integer, correct_count integer, accuracy numeric, recent_miss_count integer, eligible_question_count integer, evidence jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_lo_id uuid;
  v_lo_key text;
  v_lo_title text;
  v_evidence_count integer := 0;
  v_distinct_count integer := 0;
  v_correct_count integer := 0;
  v_accuracy numeric;
  v_recent_misses integer := 0;
  v_eligible_count integer := 0;
  v_any_evidence boolean := false;
  v_has_gap boolean := false;
  v_total_distinct integer := 0;
  v_total_attempts integer := 0;
  v_evidence jsonb := '{}'::jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select exists (
    select 1
    from public.user_attempts ua
    join public.questions q on q.id = ua.question_id and q.status = 'active'
    join pie.question_lo ql on ql.question_id = ua.question_id and ql.is_primary
    join pie.learning_objective lo on lo.id = ql.lo_id and lo.status = 'active'
    where ua.user_id = v_user
  ) into v_any_evidence;

  select count(*)::integer, count(distinct ua.question_id)::integer
    into v_total_attempts, v_total_distinct
  from public.user_attempts ua
  join public.questions q on q.id = ua.question_id and q.status = 'active'
  join pie.question_lo ql on ql.question_id = ua.question_id and ql.is_primary
  join pie.learning_objective lo on lo.id = ql.lo_id and lo.status = 'active'
  where ua.user_id = v_user;

  if not v_any_evidence or v_total_distinct < 3 then
    return query select
      'INSUFFICIENT_EVIDENCE'::text,
      case when not v_any_evidence then 'NO_MAPPED_ATTEMPTS' else 'FEWER_THAN_THREE_DISTINCT_MAPPED_QUESTIONS' end,
      null::uuid, null::text, null::text, v_total_attempts, v_total_distinct, 0, null::numeric, 0, 0,
      jsonb_build_object('minimum_distinct_questions', 3,
                         'saved_mapped_attempts', v_total_attempts,
                         'distinct_mapped_questions', v_total_distinct);
    return;
  end if;

  with objective_evidence as (
    select lo.id as lo_id, lo.lo_key, lo.title,
           count(*)::integer as attempt_count,
           count(distinct ua.question_id)::integer as question_count,
           count(*) filter (where ua.is_correct)::integer as correct_count,
           avg(case when ua.is_correct then 1.0 else 0.0 end)::numeric as accuracy,
           count(*) filter (
             where not ua.is_correct and ua.created_at >= now() - interval '30 days'
           )::integer as recent_misses,
           (
             select count(distinct q.id)::integer
             from pie.question_lo ql2
             join public.questions q on q.id = ql2.question_id and q.status = 'active'
             where ql2.lo_id = lo.id
               and ql2.is_primary
               and not exists (
                 select 1 from public.user_attempts ua2
                 where ua2.user_id = v_user and ua2.question_id = q.id
               )
               and not exists (
                 select 1 from pie.pie_question_quarantine qq
                 where qq.question_id = q.id and qq.status = 'open'
               )
               and exists (
                 select 1
                 from amc.amc_blueprint b
                 join amc.amc_blueprint_lo bl on bl.blueprint_id = b.id
                   and bl.lo_id = ql2.lo_id and bl.eligible
                 where b.blueprint_key = 'AMC_CAT_MCQ'
                   and (b.effective_from is null or b.effective_from <= now())
                   and (b.effective_to is null or b.effective_to > now())
               )
           ) as eligible_count
    from public.user_attempts ua
    join public.questions q on q.id = ua.question_id and q.status = 'active'
    join pie.question_lo ql on ql.question_id = ua.question_id and ql.is_primary
    join pie.learning_objective lo on lo.id = ql.lo_id and lo.status = 'active'
    where ua.user_id = v_user
    group by lo.id, lo.lo_key, lo.title
    having count(distinct ua.question_id) >= 3
       and (
         avg(case when ua.is_correct then 1.0 else 0.0 end) <= 0.60
         or count(*) filter (
           where not ua.is_correct and ua.created_at >= now() - interval '30 days'
         ) >= 2
       )
  )
  select exists(select 1 from objective_evidence) into v_has_gap;

  with objective_evidence as (
    select lo.id as lo_id, lo.lo_key, lo.title,
           count(*)::integer as attempt_count,
           count(distinct ua.question_id)::integer as question_count,
           count(*) filter (where ua.is_correct)::integer as correct_count,
           avg(case when ua.is_correct then 1.0 else 0.0 end)::numeric as accuracy,
           count(*) filter (
             where not ua.is_correct and ua.created_at >= now() - interval '30 days'
           )::integer as recent_misses,
           (
             select count(distinct q.id)::integer
             from pie.question_lo ql2
             join public.questions q on q.id = ql2.question_id and q.status = 'active'
             where ql2.lo_id = lo.id and ql2.is_primary
               and not exists (
                 select 1 from public.user_attempts ua2
                 where ua2.user_id = v_user and ua2.question_id = q.id
               )
               and not exists (
                 select 1 from pie.pie_question_quarantine qq
                 where qq.question_id = q.id and qq.status = 'open'
               )
               and exists (
                 select 1 from amc.amc_blueprint b
                 join amc.amc_blueprint_lo bl on bl.blueprint_id = b.id
                   and bl.lo_id = ql2.lo_id and bl.eligible
                 where b.blueprint_key = 'AMC_CAT_MCQ'
                   and (b.effective_from is null or b.effective_from <= now())
                   and (b.effective_to is null or b.effective_to > now())
               )
           ) as eligible_count
    from public.user_attempts ua
    join public.questions q on q.id = ua.question_id and q.status = 'active'
    join pie.question_lo ql on ql.question_id = ua.question_id and ql.is_primary
    join pie.learning_objective lo on lo.id = ql.lo_id and lo.status = 'active'
    where ua.user_id = v_user
    group by lo.id, lo.lo_key, lo.title
    having count(distinct ua.question_id) >= 3
       and (
         avg(case when ua.is_correct then 1.0 else 0.0 end) <= 0.60
         or count(*) filter (
           where not ua.is_correct and ua.created_at >= now() - interval '30 days'
         ) >= 2
       )
  )
  select e.lo_id, e.lo_key, e.title, e.attempt_count, e.question_count,
         e.correct_count, e.accuracy, e.recent_misses, e.eligible_count
  into v_lo_id, v_lo_key, v_lo_title, v_evidence_count, v_distinct_count,
       v_correct_count, v_accuracy, v_recent_misses, v_eligible_count
  from objective_evidence e
  where e.eligible_count >= 3
  order by e.accuracy asc, e.recent_misses desc, e.lo_key asc
  limit 1;

  if v_lo_id is null and v_has_gap then
    with objective_evidence as (
      select lo.id as lo_id, lo.lo_key, lo.title,
             count(*)::integer as attempt_count,
             count(distinct ua.question_id)::integer as question_count,
             count(*) filter (where ua.is_correct)::integer as correct_count,
             avg(case when ua.is_correct then 1.0 else 0.0 end)::numeric as accuracy,
             count(*) filter (
               where not ua.is_correct and ua.created_at >= now() - interval '30 days'
             )::integer as recent_misses,
             (
               select count(distinct q.id)::integer
               from pie.question_lo ql2
               join public.questions q on q.id = ql2.question_id and q.status = 'active'
               where ql2.lo_id = lo.id and ql2.is_primary
                 and not exists (
                   select 1 from public.user_attempts ua2
                   where ua2.user_id = v_user and ua2.question_id = q.id
                 )
                 and not exists (
                   select 1 from pie.pie_question_quarantine qq
                   where qq.question_id = q.id and qq.status = 'open'
                 )
                 and exists (
                   select 1 from amc.amc_blueprint b
                   join amc.amc_blueprint_lo bl on bl.blueprint_id = b.id
                     and bl.lo_id = ql2.lo_id and bl.eligible
                   where b.blueprint_key = 'AMC_CAT_MCQ'
                     and (b.effective_from is null or b.effective_from <= now())
                     and (b.effective_to is null or b.effective_to > now())
                 )
             ) as eligible_count
      from public.user_attempts ua
      join public.questions q on q.id = ua.question_id and q.status = 'active'
      join pie.question_lo ql on ql.question_id = ua.question_id and ql.is_primary
      join pie.learning_objective lo on lo.id = ql.lo_id and lo.status = 'active'
      where ua.user_id = v_user
      group by lo.id, lo.lo_key, lo.title
      having count(distinct ua.question_id) >= 3
         and (
           avg(case when ua.is_correct then 1.0 else 0.0 end) <= 0.60
           or count(*) filter (
             where not ua.is_correct and ua.created_at >= now() - interval '30 days'
           ) >= 2
         )
    )
    select e.lo_id, e.lo_key, e.title, e.attempt_count, e.question_count,
           e.correct_count, e.accuracy, e.recent_misses, e.eligible_count
    into v_lo_id, v_lo_key, v_lo_title, v_evidence_count, v_distinct_count,
         v_correct_count, v_accuracy, v_recent_misses, v_eligible_count
    from objective_evidence e
    order by e.accuracy asc, e.recent_misses desc, e.lo_key asc
    limit 1;

    v_evidence := jsonb_build_object(
      'source', 'public.user_attempts + pie.question_lo',
      'distinct_mapped_questions', v_distinct_count,
      'saved_attempts', v_evidence_count,
      'correct_attempts', v_correct_count,
      'accuracy', round(v_accuracy, 4),
      'recent_misses_30d', v_recent_misses,
      'selection_policy', 'nudge-gap-v1',
      'minimum_distinct_questions', 3
    );

    return query select
      'NO_ELIGIBLE_QUESTIONS'::text, 'NO_GAP_HAS_THREE_UNSEEN_QUESTIONS'::text,
      v_lo_id, v_lo_key, v_lo_title, v_evidence_count, v_distinct_count,
      v_correct_count, round(v_accuracy, 4), v_recent_misses, v_eligible_count, v_evidence;
    return;
  end if;

  if v_lo_id is null then
    return query select
      'NO_SUPPORTED_GAP'::text, 'NO_OBJECTIVE_MEETS_EVIDENCE_THRESHOLD'::text,
      null::uuid, null::text, null::text, 0, 0, 0, null::numeric, 0, 0,
      jsonb_build_object('minimum_distinct_questions', 3, 'gap_accuracy_threshold', 0.60,
                         'recent_miss_window_days', 30, 'recent_miss_threshold', 2);
    return;
  end if;

  v_evidence := jsonb_build_object(
    'source', 'public.user_attempts + pie.question_lo',
    'distinct_mapped_questions', v_distinct_count,
    'saved_attempts', v_evidence_count,
    'correct_attempts', v_correct_count,
    'accuracy', round(v_accuracy, 4),
    'recent_misses_30d', v_recent_misses,
    'eligible_unseen_questions', v_eligible_count,
    'selection_policy', 'nudge-gap-v1',
    'minimum_distinct_questions', 3
  );

  return query select
    'READY'::text,
    case when v_accuracy <= 0.60 then 'LOW_MAPPED_ACCURACY'
         else 'REPEATED_RECENT_MISSES' end,
    v_lo_id, v_lo_key, v_lo_title, v_evidence_count, v_distinct_count,
    v_correct_count, round(v_accuracy, 4), v_recent_misses, v_eligible_count, v_evidence;
end
$function$
;

revoke all on function public.get_my_nudge_target() from public, anon;
grant execute on function public.get_my_nudge_target() to authenticated, service_role;
