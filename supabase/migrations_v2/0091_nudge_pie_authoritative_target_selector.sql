-- Nudge ↔ PIE: deterministic, evidence-gated learner-facing target selector.
-- Additive proposal only. Do not apply/deploy without review.
-- Does not read mastery_mean, shadow inference, or mutate protected P12 paths.

create or replace function public.get_my_nudge_target()
returns table (
  status text,
  reason_code text,
  lo_id uuid,
  lo_key text,
  lo_title text,
  evidence_count integer,
  distinct_question_count integer,
  correct_count integer,
  accuracy numeric,
  recent_miss_count integer,
  eligible_question_count integer,
  evidence jsonb
)
language plpgsql
security definer
set search_path = ''
as $function$
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
  v_evidence jsonb := '{}'::jsonb;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Derive from server-saved attempts + primary mappings. Never trust heuristic
  -- learner_lo_state mastery fields as the source of candidate-facing advice.
  select exists (
    select 1
    from public.user_attempts ua
    join pie.question_lo ql on ql.question_id = ua.question_id and ql.is_primary
    join pie.learning_objective lo on lo.id = ql.lo_id and lo.status = 'active'
    where ua.user_id = v_user
  ) into v_any_evidence;

  if not v_any_evidence then
    return query select
      'INSUFFICIENT_EVIDENCE'::text, 'NO_MAPPED_ATTEMPTS'::text,
      null::uuid, null::text, null::text, 0, 0, 0, null::numeric, 0, 0,
      jsonb_build_object('minimum_distinct_questions', 3);
    return;
  end if;

  -- Choose a supported gap only after at least 3 distinct mapped questions.
  -- Ranking is deterministic: lowest accuracy, most recent misses, then stable LO key.
  select ranked.lo_id, ranked.lo_key, ranked.title,
         ranked.attempt_count, ranked.question_count, ranked.correct_count,
         ranked.accuracy, ranked.recent_misses
    into v_lo_id, v_lo_key, v_lo_title,
         v_evidence_count, v_distinct_count, v_correct_count,
         v_accuracy, v_recent_misses
  from (
    select lo.id as lo_id, lo.lo_key, lo.title,
           count(*)::integer as attempt_count,
           count(distinct ua.question_id)::integer as question_count,
           count(*) filter (where ua.is_correct)::integer as correct_count,
           avg(case when ua.is_correct then 1.0 else 0.0 end)::numeric as accuracy,
           count(*) filter (
             where not ua.is_correct and ua.created_at >= now() - interval '30 days'
           )::integer as recent_misses
    from public.user_attempts ua
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
  ) ranked
  order by ranked.accuracy asc, ranked.recent_misses desc, ranked.lo_key asc
  limit 1;

  if v_lo_id is null then
    return query select
      'NO_SUPPORTED_GAP'::text, 'NO_OBJECTIVE_MEETS_EVIDENCE_THRESHOLD'::text,
      null::uuid, null::text, null::text, 0, 0, 0, null::numeric, 0, 0,
      jsonb_build_object('minimum_distinct_questions', 3, 'gap_accuracy_threshold', 0.60,
                         'recent_miss_window_days', 30, 'recent_miss_threshold', 2);
    return;
  end if;

  -- A Nudge target must have at least 3 currently active, primary-mapped,
  -- not-yet-attempted questions. No fallback to unmapped content.
  select count(distinct q.id)::integer
    into v_eligible_count
  from pie.question_lo ql
  join public.questions q on q.id = ql.question_id and q.status = 'active'
  where ql.lo_id = v_lo_id
    and ql.is_primary
    and not exists (
      select 1 from public.user_attempts ua
      where ua.user_id = v_user and ua.question_id = q.id
    );

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

  if v_eligible_count < 3 then
    return query select
      'NO_ELIGIBLE_QUESTIONS'::text, 'FEWER_THAN_THREE_UNSEEN_MAPPED_QUESTIONS'::text,
      v_lo_id, v_lo_key, v_lo_title, v_evidence_count, v_distinct_count,
      v_correct_count, round(v_accuracy, 4), v_recent_misses, v_eligible_count, v_evidence;
    return;
  end if;

  return query select
    'READY'::text,
    case when v_accuracy <= 0.60 then 'LOW_MAPPED_ACCURACY'
         else 'REPEATED_RECENT_MISSES' end,
    v_lo_id, v_lo_key, v_lo_title, v_evidence_count, v_distinct_count,
    v_correct_count, round(v_accuracy, 4), v_recent_misses, v_eligible_count, v_evidence;
end
$function$;

revoke all on function public.get_my_nudge_target() from public, anon;
grant execute on function public.get_my_nudge_target() to authenticated, service_role;
