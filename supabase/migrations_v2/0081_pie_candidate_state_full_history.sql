-- 0081: use the full eligible candidate evidence history for authoritative PIE state.
-- Additive replacement for pie.rebuild_candidate_state; does not rewrite prior migrations.
-- Evidence remains restricted to first exposure in registered adaptive sessions and
-- completed sessions. No learner-facing grants or RLS policies are changed.

create or replace function pie.rebuild_candidate_state(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_model uuid;
  v_run uuid;
  v_state_id uuid;
  v_n integer;
  v_accuracy numeric;
  v_confidence numeric;
  v_timing numeric;
  v_changes numeric;
  v_state jsonb;
begin
  if p_user_id is null then
    raise exception 'User id required' using errcode = '22004';
  end if;

  -- Preserve the existing owner boundary. service_role may rebuild any candidate;
  -- learner JWTs may rebuild only themselves; no JWT is accepted only for privileged DB roles.
  if v_role = 'service_role' then
    null;
  elsif v_uid is not null and v_uid = p_user_id then
    null;
  elsif v_uid is null and v_role = '' then
    null;
  else
    raise exception 'User scope violation' using errcode = '42501';
  end if;

  -- New model version avoids reusing v2.0 metadata that explicitly declared a 100-row cap.
  insert into pie.pie_model_version (model_key, version, status, config)
  values (
    'candidate-state',
    'v2.1',
    'active',
    jsonb_build_object(
      'method', 'deterministic_full_history_state',
      'evidence_scope', 'all_eligible_first_exposure_completed_adaptive_attempts',
      'window', 'full_history'
    )
  )
  on conflict (model_key, version) do nothing;

  select id into v_model
  from pie.pie_model_version
  where model_key = 'candidate-state' and version = 'v2.1';

  -- Full eligible history: deliberately no LIMIT. Eligibility remains unchanged.
  with eligible as (
    select o.payload
    from pie.pie_observation o
    join public.user_attempts ua on ua.id = o.attempt_id
    join public.practice_sessions ps
      on ps.id = ua.session_id
     and ps.user_id = p_user_id
     and ps.status = 'completed'
    join pie.first_exposure_attempt_ids(p_user_id) fe on fe.id = ua.id
    where o.user_id = p_user_id
  )
  select
    count(*)::int,
    coalesce(avg(case
      when payload->>'outcome' = 'CORRECT' then 1
      when payload->>'outcome' = 'INCORRECT' then 0
    end), 0),
    coalesce(avg(nullif((payload->>'confidence_normalized')::numeric, null)), 0.5),
    coalesce(avg(case
      when (payload->>'time_total_ms')::numeric > 0
      then 1 / (1 + ln(1 + (payload->>'time_total_ms')::numeric / 1000) / 10)
    end), 0.5),
    coalesce(avg(least(1, greatest(0,
      1 - (coalesce((payload->>'answer_changes')::numeric, 0) / 3)
    ))), 0.5)
  into v_n, v_accuracy, v_confidence, v_timing, v_changes
  from eligible;

  v_state := jsonb_build_object(
    'capability', jsonb_build_object('estimate', round(v_accuracy, 4)),
    'decision', jsonb_build_object('estimate', round(v_changes, 4)),
    'timing', jsonb_build_object('estimate', round(v_timing, 4)),
    'calibration', jsonb_build_object('estimate', round(1 - abs(v_confidence - v_accuracy), 4)),
    'sustained_performance', jsonb_build_object('estimate', round(v_accuracy, 4)),
    'learning', jsonb_build_object('estimate', round(v_accuracy, 4)),
    'evidence_count', v_n,
    'evidence_level', case
      when v_n < 6 then 'INSUFFICIENT'
      when v_n < 20 then 'PRELIMINARY'
      when v_n < 40 then 'DEVELOPING'
      else 'ESTABLISHED_INDIVIDUAL_EVIDENCE'
    end
  );

  insert into pie.pie_inference_run
    (user_id, model_version_id, trigger_type, input_window, output_summary, status, started_at, completed_at)
  values (
    p_user_id,
    v_model,
    'REBUILD',
    jsonb_build_object(
      'observation_count', v_n,
      'evidence_scope', 'all_eligible_first_exposure_completed_adaptive_attempts',
      'window', 'full_history'
    ),
    v_state,
    'completed',
    now(),
    now()
  )
  returning id into v_run;

  insert into pie.pie_candidate_state as cs
    (user_id, state_version, state, confidence, model_version_id, source_inference_id, calculated_at, updated_at)
  values
    (p_user_id, 1, v_state, least(1, greatest(0, v_n / 100.0)), v_model, v_run, now(), now())
  on conflict (user_id) do update
    set state_version = cs.state_version + 1,
        state = excluded.state,
        confidence = excluded.confidence,
        model_version_id = excluded.model_version_id,
        source_inference_id = excluded.source_inference_id,
        calculated_at = excluded.calculated_at,
        updated_at = excluded.updated_at
  returning cs.id into v_state_id;

  return v_state_id;
end
$$;

-- Keep the internal rebuild privileged; learner-facing access continues through the
-- existing public self-scoped wrapper and its established grants.
revoke all on function pie.rebuild_candidate_state(uuid) from public, anon, authenticated;
grant execute on function pie.rebuild_candidate_state(uuid) to service_role;
