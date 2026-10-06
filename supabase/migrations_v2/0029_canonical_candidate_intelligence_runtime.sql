create or replace function intelligence.rebuild_candidate(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = intelligence, public, pg_temp
as $$
declare
  v_count int;
  v_accuracy numeric;
  v_stability numeric;
  v_timing numeric;
  v_calibration numeric;
  v_over numeric;
  v_under numeric;
  v_readiness numeric;
  v_band text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;

  select count(*)::int,
    coalesce(avg(case when is_correct then 1 else 0 end),0),
    coalesce(avg(least(1,greatest(0,1-coalesce(answer_changes_count,0)/3.0))),0.5),
    coalesce(avg(case when time_taken_seconds is null then 0.5 else 1/(1+ln(1+greatest(time_taken_seconds,1)/52.0)) end),0.5),
    coalesce(avg(case when confidence_level is null then null else 1-abs((confidence_level-1)/4.0-(case when is_correct then 1 else 0 end)) end),0.5),
    coalesce(avg(case when confidence_level is null then null else greatest(0,(confidence_level-1)/4.0-(case when is_correct then 1 else 0 end)) end),0),
    coalesce(avg(case when confidence_level is null then null else greatest(0,(case when is_correct then 1 else 0 end)-(confidence_level-1)/4.0) end),0)
  into v_count,v_accuracy,v_stability,v_timing,v_calibration,v_over,v_under
  from public.user_attempts
  where user_id=p_user_id;

  v_readiness := greatest(0,least(1,
    0.45*v_accuracy + 0.20*v_stability + 0.15*v_timing + 0.20*v_calibration
  ));
  v_band := case when v_count < 10 then 'INSUFFICIENT'
    when v_readiness < 0.50 then 'DEVELOPING'
    when v_readiness < 0.70 then 'PROGRESSING'
    when v_readiness < 0.85 then 'STRONG'
    else 'EXAM_READY'
  end;

  insert into intelligence.behavior_dna(user_id,archetype,rush_index,hesitation_index,fatigue_index,stability_metrics,evidence_window,model_version,calculated_at,updated_at)
  values(p_user_id,
    case when v_stability >= 0.75 then 'STABLE' when v_timing < 0.35 then 'RUSHING' else 'VARIABLE' end,
    greatest(0,least(1,1-v_timing)),
    greatest(0,least(1,v_timing)),
    greatest(0,least(1,1-v_stability)),
    jsonb_build_object('answer_stability',v_stability),
    jsonb_build_object('attempt_count',v_count),
    'v2-canonical-1.0',now(),now())
  on conflict(user_id) do update set
    archetype=excluded.archetype,rush_index=excluded.rush_index,hesitation_index=excluded.hesitation_index,
    fatigue_index=excluded.fatigue_index,stability_metrics=excluded.stability_metrics,evidence_window=excluded.evidence_window,
    model_version=excluded.model_version,calculated_at=excluded.calculated_at,updated_at=excluded.updated_at;

  insert into intelligence.confidence_intelligence(user_id,evidence_window,calibration_score,overconfidence_score,underconfidence_score,stability_score,dimensions,model_version,calculated_at,created_at)
  values(p_user_id,jsonb_build_object('attempt_count',v_count),v_calibration,v_over,v_under,v_stability,
    jsonb_build_object('calibration',v_calibration,'overconfidence',v_over,'underconfidence',v_under),
    'v2-canonical-1.0',now(),now())
  on conflict(user_id) do update set
    evidence_window=excluded.evidence_window,calibration_score=excluded.calibration_score,
    overconfidence_score=excluded.overconfidence_score,underconfidence_score=excluded.underconfidence_score,
    stability_score=excluded.stability_score,dimensions=excluded.dimensions,model_version=excluded.model_version,calculated_at=excluded.calculated_at;

  insert into intelligence.readiness_dna(user_id,readiness_score,readiness_band,dimensions,evidence_window,model_version,calculated_at,updated_at)
  values(p_user_id,v_readiness*100,v_band,
    jsonb_build_object('clinical_accuracy',v_accuracy*100,'answer_stability',v_stability*100,'time_management',v_timing*100,'confidence_calibration',v_calibration*100),
    jsonb_build_object('attempt_count',v_count),'v2-canonical-1.0',now(),now())
  on conflict(user_id) do update set
    readiness_score=excluded.readiness_score,readiness_band=excluded.readiness_band,dimensions=excluded.dimensions,
    evidence_window=excluded.evidence_window,model_version=excluded.model_version,calculated_at=excluded.calculated_at,updated_at=excluded.updated_at;

  insert into intelligence.subject_dna(user_id,subject_id,accuracy,timing_profile,confidence_profile,dimensions,evidence_window,model_version,calculated_at,updated_at)
  select p_user_id,ua.subject_id,
    avg(case when ua.is_correct then 1 else 0 end),
    jsonb_build_object('avg_time_seconds',avg(ua.time_taken_seconds)),
    jsonb_build_object('avg_confidence',avg(case when ua.confidence_level is null then null else (ua.confidence_level-1)/4.0 end)),
    jsonb_build_object('stability',avg(least(1,greatest(0,1-coalesce(ua.answer_changes_count,0)/3.0)))),
    jsonb_build_object('attempt_count',count(*)),
    'v2-canonical-1.0',now(),now()
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

create or replace function public.refresh_candidate_intelligence()
returns void
language plpgsql
security definer
set search_path = public, intelligence, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform intelligence.rebuild_candidate(auth.uid());
end $$;

revoke all on function intelligence.rebuild_candidate(uuid) from public, anon, authenticated;
grant execute on function intelligence.rebuild_candidate(uuid) to service_role;
revoke all on function public.refresh_candidate_intelligence() from public, anon;
grant execute on function public.refresh_candidate_intelligence() to authenticated;