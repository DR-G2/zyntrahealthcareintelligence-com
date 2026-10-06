-- V2 PIE runtime minimum: canonical observation ingestion + deterministic state rebuild.
create or replace function pie.record_observation(
  p_observation_type text,
  p_payload jsonb,
  p_attempt_id uuid default null,
  p_question_id uuid default null,
  p_event_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = pie, public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_observation_type is null or length(trim(p_observation_type)) = 0 then
    raise exception 'Observation type required';
  end if;
  insert into pie.pie_observation(user_id,question_id,attempt_id,event_id,observation_type,observed_at,payload,provenance)
  values(v_user,p_question_id,p_attempt_id,p_event_id,trim(p_observation_type),now(),coalesce(p_payload,'{}'::jsonb),
         jsonb_build_object('source','v2_rpc','user_id',v_user::text))
  returning id into v_id;
  return v_id;
end $$;

create or replace function pie.rebuild_candidate_state(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pie, public, pg_temp
as $$
declare
  v_model uuid;
  v_state_id uuid;
  v_seq integer;
  v_n integer;
  v_accuracy numeric;
  v_confidence numeric;
  v_timing numeric;
  v_changes numeric;
  v_state jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_user_id is null then raise exception 'User id required'; end if;

  insert into pie.pie_model_version(model_key,version,status,config)
  values('candidate-state','v2.0','SHADOW',jsonb_build_object('method','deterministic_bounded_state','window',100))
  on conflict do nothing;

  select id into v_model from pie.pie_model_version
  where model_key='candidate-state' and version='v2.0'
  limit 1;

  with recent as (
    select payload from pie.pie_observation
    where user_id=p_user_id
    order by observed_at desc limit 100
  )
  select count(*)::int,
         coalesce(avg(case when payload->>'outcome'='CORRECT' then 1 when payload->>'outcome'='INCORRECT' then 0 end),0),
         coalesce(avg(nullif((payload->>'confidence_normalized')::numeric,null)),0.5),
         coalesce(avg(case when (payload->>'time_total_ms')::numeric > 0 then
             1/(1+ln(1+(payload->>'time_total_ms')::numeric/1000)/10) end),0.5),
         coalesce(avg(least(1,greatest(0,1-(coalesce((payload->>'answer_changes')::numeric,0)/3)))),0.5)
  into v_n,v_accuracy,v_confidence,v_timing,v_changes
  from recent;

  v_state := jsonb_build_object(
    'capability', jsonb_build_object('estimate',round(v_accuracy,4)),
    'decision', jsonb_build_object('estimate',round(v_changes,4)),
    'timing', jsonb_build_object('estimate',round(v_timing,4)),
    'calibration', jsonb_build_object('estimate',round(1-abs(v_confidence-v_accuracy),4)),
    'sustained_performance', jsonb_build_object('estimate',round(v_accuracy,4)),
    'learning', jsonb_build_object('estimate',round(v_accuracy,4)),
    'evidence_count',v_n,
    'evidence_level',case when v_n < 6 then 'INSUFFICIENT' when v_n < 20 then 'PRELIMINARY' when v_n < 40 then 'DEVELOPING' else 'ESTABLISHED_INDIVIDUAL_EVIDENCE' end
  );

  select coalesce(max(state_version),0)+1 into v_seq from pie.pie_candidate_state where user_id=p_user_id;
  insert into pie.pie_candidate_state(user_id,state_version,state,confidence,model_version_id,calculated_at,updated_at)
  values(p_user_id,v_seq,v_state,least(1,greatest(0,v_n/100.0)),v_model,now(),now())
  returning id into v_state_id;

  insert into pie.pie_inference_run(user_id,model_version_id,trigger_type,input_window,output_summary,status,started_at,completed_at)
  values(p_user_id,v_model,'REBUILD',jsonb_build_object('observation_count',v_n,'window',100),v_state,'COMPLETED',now(),now());

  return v_state_id;
end $$;

revoke all on function pie.record_observation(text,jsonb,uuid,uuid,uuid) from public, anon;
grant execute on function pie.record_observation(text,jsonb,uuid,uuid,uuid) to authenticated;

revoke all on function pie.rebuild_candidate_state(uuid) from public, anon, authenticated;
grant execute on function pie.rebuild_candidate_state(uuid) to service_role;
