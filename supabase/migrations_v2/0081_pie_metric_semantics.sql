-- PIE metric semantics correction. This migration changes the deployed producer,
-- not just the source migration. Readiness is a training signal, not an AMC pass prediction.
create or replace function intelligence.rebuild_candidate(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = intelligence, public, pg_temp
as $$
declare
  v_count int;
  v_timed_count int;
  v_confidence_count int;
  v_change_count int;
  v_accuracy numeric;
  v_stability numeric;
  v_timing numeric;
  v_calibration numeric;
  v_over numeric;
  v_under numeric;
  v_rush numeric;
  v_hesitation numeric;
  v_fatigue numeric;
  v_readiness numeric;
  v_band text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;

  select count(*)::int,
    count(*) filter (where time_taken_seconds is not null and time_taken_seconds >= 0)::int,
    count(*) filter (where confidence_level between 1 and 5)::int,
    count(*) filter (where answer_changes_count is not null)::int,
    avg(case when is_correct then 1.0 else 0.0 end),
    avg(case when answer_changes_count is null then null
      else least(1.0,greatest(0.0,1.0-answer_changes_count/3.0)) end),
    avg(case when time_taken_seconds is not null and time_taken_seconds >= 0
      then case when time_taken_seconds between 15 and 180 then 1.0 else 0.0 end end),
    avg(case when confidence_level between 1 and 5
      then 1.0 - abs((confidence_level-1)/4.0 - (case when is_correct then 1.0 else 0.0 end)) end),
    avg(case when confidence_level between 1 and 5
      then greatest(0.0,(confidence_level-1)/4.0 - (case when is_correct then 1.0 else 0.0 end)) end),
    avg(case when confidence_level between 1 and 5
      then greatest(0.0,(case when is_correct then 1.0 else 0.0 end) - (confidence_level-1)/4.0) end),
    avg(case when time_taken_seconds between 0 and 45 and not is_correct then 1.0 else 0.0 end)
      filter (where time_taken_seconds is not null and time_taken_seconds >= 0),
    avg(case when time_taken_seconds >= 180 then 1.0 else 0.0 end)
      filter (where time_taken_seconds is not null and time_taken_seconds >= 0)
  into v_count,v_timed_count,v_confidence_count,v_change_count,v_accuracy,v_stability,v_timing,
       v_calibration,v_over,v_under,v_rush,v_hesitation
  from public.user_attempts
  where user_id=p_user_id;

  -- A fatigue signal requires same-session deterioration in accuracy, timing and
  -- answer-change rate, with at least 10 observations in each half. Timing alone
  -- and answer instability alone are not labelled fatigue.
  with session_rows as (
    select ua.*,
      row_number() over (partition by session_id order by question_position nulls last, created_at, id) as rn,
      count(*) over (partition by session_id) as n
    from public.user_attempts ua
    where ua.user_id=p_user_id and session_id is not null
  ), halves as (
    select session_id,
      avg(case when rn <= n/2.0 then case when is_correct then 1.0 else 0.0 end end) as early_accuracy,
      avg(case when rn > n/2.0 then case when is_correct then 1.0 else 0.0 end end) as late_accuracy,
      avg(time_taken_seconds) filter (where rn <= n/2.0 and time_taken_seconds > 0) as early_time,
      avg(time_taken_seconds) filter (where rn > n/2.0 and time_taken_seconds > 0) as late_time,
      avg(answer_changes_count) filter (where rn <= n/2.0 and answer_changes_count is not null) as early_changes,
      avg(answer_changes_count) filter (where rn > n/2.0 and answer_changes_count is not null) as late_changes,
      count(*) filter (where rn <= n/2.0) as early_n,
      count(*) filter (where rn > n/2.0) as late_n,
      count(time_taken_seconds) filter (where rn <= n/2.0 and time_taken_seconds > 0) as early_timed,
      count(time_taken_seconds) filter (where rn > n/2.0 and time_taken_seconds > 0) as late_timed
    from session_rows
    group by session_id
  ), eligible as (
    select greatest(0.0,least(1.0,((early_accuracy-late_accuracy) + least(1.0,(late_time/ nullif(early_time,0))-1.0))/2.0)) as signal
    from halves
    where early_n >= 10 and late_n >= 10 and early_timed >= 8 and late_timed >= 8
      and early_accuracy-late_accuracy >= 0.15
      and late_time >= early_time*1.20
      and late_changes > early_changes
  )
  select avg(signal) into v_fatigue from eligible;

  -- Never impute a neutral confidence score. Readiness requires observed accuracy,
  -- stability and at least 10 valid confidence observations. Timing is descriptive
  -- only until a question-difficulty-adjusted target model is validated.
  if v_count >= 30 and v_accuracy is not null and v_stability is not null and v_confidence_count >= 10 and v_calibration is not null then
    v_readiness := greatest(0.0,least(1.0,0.65*v_accuracy + 0.20*v_stability + 0.15*v_calibration));
    v_band := case when v_readiness < 0.50 then 'DEVELOPING'
      when v_readiness < 0.70 then 'PROGRESSING'
      else 'STRONG' end;
  else
    v_readiness := 0;
    v_band := 'INSUFFICIENT';
  end if;

  insert into intelligence.behavior_dna(user_id,archetype,rush_index,hesitation_index,fatigue_index,stability_metrics,evidence_window,model_version,calculated_at,updated_at)
  values(p_user_id,
    case when v_count < 10 then 'INSUFFICIENT'
      when v_stability >= 0.75 then 'STABLE'
      when coalesce(v_rush,0) >= 0.25 then 'RAPID_INCORRECT'
      when coalesce(v_hesitation,0) >= 0.25 then 'SLOW_RESPONSE'
      else 'VARIABLE' end,
    v_rush,v_hesitation,v_fatigue,
    jsonb_build_object('answer_stability',v_stability,'fatigue_signal_available',v_fatigue is not null),
    jsonb_build_object('attempt_count',v_count,'timed_count',v_timed_count,'change_observation_count',v_change_count,
      'confidence_count',v_confidence_count,'timing_is_readiness_input',false),
    'v2-canonical-1.1',now(),now())
  on conflict(user_id) do update set
    archetype=excluded.archetype,rush_index=excluded.rush_index,hesitation_index=excluded.hesitation_index,
    fatigue_index=excluded.fatigue_index,stability_metrics=excluded.stability_metrics,evidence_window=excluded.evidence_window,
    model_version=excluded.model_version,calculated_at=excluded.calculated_at,updated_at=excluded.updated_at;

  insert into intelligence.confidence_intelligence(user_id,evidence_window,calibration_score,overconfidence_score,underconfidence_score,stability_score,dimensions,model_version,calculated_at,created_at)
  values(p_user_id,jsonb_build_object('attempt_count',v_count,'confidence_count',v_confidence_count),
    v_calibration,v_over,v_under,v_stability,
    jsonb_build_object('confidence_alignment',v_calibration,'overconfidence',v_over,'underconfidence',v_under,
      'calibration_available',v_confidence_count >= 10),
    'v2-canonical-1.1',now(),now())
  on conflict(user_id) do update set
    evidence_window=excluded.evidence_window,calibration_score=excluded.calibration_score,
    overconfidence_score=excluded.overconfidence_score,underconfidence_score=excluded.underconfidence_score,
    stability_score=excluded.stability_score,dimensions=excluded.dimensions,model_version=excluded.model_version,calculated_at=excluded.calculated_at;

  insert into intelligence.readiness_dna(user_id,readiness_score,readiness_band,dimensions,evidence_window,model_version,calculated_at,updated_at)
  values(p_user_id,v_readiness*100,v_band,
    jsonb_build_object('clinical_accuracy',v_accuracy*100,'answer_stability',v_stability*100,
      'time_management',v_timing*100,'confidence_calibration',v_calibration*100),
    jsonb_build_object('attempt_count',v_count,'timed_count',v_timed_count,'confidence_count',v_confidence_count,
      'required_confidence_observations',10,'readiness_inputs',jsonb_build_array('clinical_accuracy','answer_stability','confidence_alignment'),
      'is_exam_pass_probability',false),
    'v2-canonical-1.1',now(),now())
  on conflict(user_id) do update set
    readiness_score=excluded.readiness_score,readiness_band=excluded.readiness_band,dimensions=excluded.dimensions,
    evidence_window=excluded.evidence_window,model_version=excluded.model_version,calculated_at=excluded.calculated_at,updated_at=excluded.updated_at;

  insert into intelligence.subject_dna(user_id,subject_id,accuracy,timing_profile,confidence_profile,dimensions,evidence_window,model_version,calculated_at,updated_at)
  select p_user_id,ua.subject_id,
    avg(case when ua.is_correct then 1.0 else 0.0 end),
    jsonb_build_object('avg_time_seconds',avg(ua.time_taken_seconds) filter (where ua.time_taken_seconds is not null and ua.time_taken_seconds >= 0),
      'timed_attempt_count',count(ua.time_taken_seconds) filter (where ua.time_taken_seconds is not null and ua.time_taken_seconds >= 0)),
    jsonb_build_object('avg_confidence',avg(case when ua.confidence_level between 1 and 5 then (ua.confidence_level-1)/4.0 end),
      'confidence_count',count(ua.confidence_level) filter (where ua.confidence_level between 1 and 5)),
    jsonb_build_object('stability',avg(case when ua.answer_changes_count is null then null else least(1.0,greatest(0.0,1.0-ua.answer_changes_count/3.0)) end)),
    jsonb_build_object('attempt_count',count(*)),
    'v2-canonical-1.1',now(),now()
  from (
    select a.*,q.subject_id from public.user_attempts a join public.questions q on q.id=a.question_id where a.user_id=p_user_id
  ) ua
  where ua.subject_id is not null
  group by ua.subject_id
  on conflict(user_id,subject_id) do update set
    accuracy=excluded.accuracy,timing_profile=excluded.timing_profile,confidence_profile=excluded.confidence_profile,
    dimensions=excluded.dimensions,evidence_window=excluded.evidence_window,model_version=excluded.model_version,
    calculated_at=excluded.calculated_at,updated_at=excluded.updated_at;

  delete from intelligence.next_best_actions where user_id=p_user_id;
  insert into intelligence.next_best_actions(user_id,action_type,action_data,priority,created_at,updated_at)
  select p_user_id,'FOCUS_WEAK_SUBJECT',
    jsonb_build_object('subject_id',s.subject_id,'accuracy',s.accuracy,'reason','Lowest observed subject accuracy'),
    greatest(0,least(1,1-s.accuracy)),now(),now()
  from intelligence.subject_dna s
  where s.user_id=p_user_id
  order by s.accuracy asc
  limit 1;
end $$;

comment on function intelligence.rebuild_candidate(uuid) is
'PIE v2 canonical metric producer v1.1. Readiness is a training signal, not an AMC pass prediction; missing confidence is unavailable, not neutral.';
