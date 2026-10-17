-- PIE state metric rewrite v2.2.
-- Preserve the six dimensions, but calculate each from a distinct observable signal.
-- This migration is source-only until explicitly applied to the database.
create or replace function pie.rebuild_candidate_state(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_model uuid;
  v_run uuid;
  v_state_id uuid;
  v_n integer := 0;
  v_accuracy_n integer := 0;
  v_change_n integer := 0;
  v_time_n integer := 0;
  v_confidence_n integer := 0;
  v_accuracy numeric;
  v_decision numeric;
  v_timing numeric;
  v_calibration numeric;
  v_sustained numeric;
  v_learning numeric;
  v_learning_slope numeric;
  v_confidence numeric;
  v_mean_seconds numeric;
  v_state jsonb;
begin
  if p_user_id is null then
    raise exception 'User id required' using errcode = '22004';
  end if;

  if v_role = 'service_role' then
    null;
  elsif v_uid is not null and v_uid = p_user_id then
    null;
  else
    raise exception 'User scope violation' using errcode = '42501';
  end if;

  insert into pie.pie_model_version (model_key, version, status, config)
  values (
    'candidate-state', 'v2.2', 'active',
    jsonb_build_object(
      'method', 'distinct_observed_dimensions_v2',
      'window', 'full_history',
      'readiness_prediction', false,
      'dimension_definitions', jsonb_build_object(
        'capability', 'attempt_accuracy',
        'decision', 'answer_stability_from_known_change_telemetry',
        'timing', 'descriptive_response_pace_index_not_skill',
        'calibration', 'mean_per_attempt_confidence_correctness_alignment',
        'sustained_performance', 'consistency_across_chronological_blocks',
        'learning', 'chronological_accuracy_trend'
      )
    )
  )
  on conflict (model_key, version) do nothing;

  select id into v_model
  from pie.pie_model_version
  where model_key = 'candidate-state' and version = 'v2.2';

  -- One latest observation per attempt prevents duplicate events from inflating evidence.
  with latest as (
    select distinct on (o.attempt_id)
      o.attempt_id, o.observed_at, o.payload
    from pie.pie_observation o
    where o.user_id = p_user_id and o.attempt_id is not null
    order by o.attempt_id, o.observed_at desc, o.id desc
  ), parsed as (
    select attempt_id, observed_at, payload,
      case
        when payload->>'outcome' = 'CORRECT' then 1.0
        when payload->>'outcome' = 'INCORRECT' then 0.0
        when lower(payload->>'is_correct') = 'true' then 1.0
        when lower(payload->>'is_correct') = 'false' then 0.0
        else null
      end as correct,
      case
        when payload ? 'confidence_normalized'
          and (payload->>'confidence_normalized') ~ '^(0([.][0-9]+)?|1([.]0+)?)$'
        then (payload->>'confidence_normalized')::numeric
        when payload ? 'confidence_level'
          and (payload->>'confidence_level') ~ '^[1-5]$'
        then ((payload->>'confidence_level')::numeric - 1) / 4.0
        else null
      end as confidence,
      case
        when payload ? 'time_total_ms' and (payload->>'time_total_ms') ~ '^[0-9]+([.][0-9]+)?$'
          and (payload->>'time_total_ms')::numeric > 0
          then (payload->>'time_total_ms')::numeric / 1000.0
        when payload ? 'time_taken_seconds' and (payload->>'time_taken_seconds') ~ '^[0-9]+([.][0-9]+)?$'
          and (payload->>'time_taken_seconds')::numeric >= 0
          then (payload->>'time_taken_seconds')::numeric
        else null
      end as seconds,
      case
        when payload ? 'answer_changes' and (payload->>'answer_changes') ~ '^[0-9]+$'
          then (payload->>'answer_changes')::integer
        else null
      end as changes
    from latest
  ), eligible as (
    select * from parsed where correct is not null
  ), numbered as (
    select e.*,
      ntile(4) over (order by observed_at, attempt_id) as block_no
    from eligible e
  ), block_accuracy as (
    select block_no, avg(correct) as accuracy, count(*)::int as n
    from numbered
    group by block_no
  ), block_stats as (
    select count(*)::int as block_count,
      stddev_pop(accuracy) as block_sd,
      regr_slope(accuracy, block_no::numeric) as accuracy_slope
    from block_accuracy
  )
  select
    (select count(*)::int from parsed),
    (select count(*)::int from eligible),
    (select count(*)::int from parsed where changes is not null),
    (select count(*)::int from parsed where seconds is not null),
    (select count(*)::int from parsed where confidence is not null and correct is not null),
    (select avg(correct) from eligible),
    (select avg(case when changes = 0 then 1.0 when changes > 0 then 0.0 end)
      from parsed where changes is not null),
    (select avg(1.0 / (1.0 + ln(1.0 + seconds / 30.0))) from parsed where seconds is not null),
    (select avg(1.0 - abs(confidence - correct))
      from parsed where confidence is not null and correct is not null),
    (select greatest(0.0, least(1.0, 1.0 - coalesce(block_sd, 0.5)))
      from block_stats where block_count >= 3),
    (select accuracy_slope from block_stats where block_count >= 3),
    (select avg(confidence) from parsed where confidence is not null),
    (select avg(seconds) from parsed where seconds is not null)
  into v_n, v_accuracy_n, v_change_n, v_time_n, v_confidence_n,
       v_accuracy, v_decision, v_timing, v_calibration, v_sustained,
       v_learning_slope, v_confidence, v_mean_seconds;

  -- Learning is a trend, not a duplicated accuracy score. Neutral means no
  -- estimated trend; the separate slope and block evidence are retained.
  if v_accuracy_n >= 12 and v_learning_slope is not null then
    v_learning := greatest(0.0, least(1.0, 0.5 + v_learning_slope));
  else
    v_learning := null;
  end if;

  -- Confidence alignment is calculated per attempt. It is descriptive alignment,
  -- not a formally validated calibration curve.
  if v_confidence_n < 10 then
    v_calibration := null;
  end if;

  v_state := jsonb_build_object(
    'capability', jsonb_build_object(
      'estimate', case when v_accuracy_n > 0 then round(v_accuracy, 4) else null end,
      'evidence_count', v_accuracy_n,
      'definition', 'Observed accuracy among graded attempts'
    ),
    'decision', jsonb_build_object(
      'estimate', case when v_change_n >= 6 then round(v_decision, 4) else null end,
      'evidence_count', v_change_n,
      'definition', 'Share of attempts with known change telemetry that had no answer changes'
    ),
    'timing', jsonb_build_object(
      'estimate', case when v_time_n >= 6 then round(v_timing, 4) else null end,
      'evidence_count', v_time_n,
      'mean_seconds', v_mean_seconds,
      'definition', 'Descriptive response-pace index; not a measure of competence or exam readiness',
      'formula_version', 'pace-log30-v1'
    ),
    'calibration', jsonb_build_object(
      'estimate', case when v_confidence_n >= 10 then round(v_calibration, 4) else null end,
      'evidence_count', v_confidence_n,
      'mean_confidence', case when v_confidence_n >= 10 then round(v_confidence, 4) else null end,
      'definition', 'Mean per-attempt agreement between normalized confidence and correctness; not a formal calibration curve'
    ),
    'sustained_performance', jsonb_build_object(
      'estimate', case when v_sustained is not null then round(v_sustained, 4) else null end,
      'evidence_count', v_accuracy_n,
      'definition', 'One minus variability of accuracy across up to four chronological blocks; requires at least three blocks'
    ),
    'learning', jsonb_build_object(
      'estimate', case when v_learning is not null then round(v_learning, 4) else null end,
      'evidence_count', v_accuracy_n,
      'accuracy_slope_per_block', case when v_learning_slope is not null then round(v_learning_slope, 4) else null end,
      'definition', 'Chronological accuracy trend across four blocks; not causal proof that an intervention worked'
    ),
    'evidence_count', v_accuracy_n,
    'observation_count', v_n,
    'evidence_level', case
      when v_accuracy_n < 6 then 'INSUFFICIENT'
      when v_accuracy_n < 20 then 'PRELIMINARY'
      when v_accuracy_n < 40 then 'DEVELOPING'
      else 'ESTABLISHED_INDIVIDUAL_EVIDENCE'
    end,
    'model_version', 'candidate-state/v2.2',
    'readiness_prediction', false
  );

  insert into pie.pie_inference_run
    (user_id, model_version_id, trigger_type, input_window, output_summary, status, started_at, completed_at)
  values (
    p_user_id, v_model, 'REBUILD',
    jsonb_build_object(
      'observation_count', v_n,
      'graded_attempt_count', v_accuracy_n,
      'timed_attempt_count', v_time_n,
      'change_telemetry_count', v_change_n,
      'confidence_count', v_confidence_n,
      'window', 'full_history'
    ),
    v_state, 'completed', now(), now()
  )
  returning id into v_run;

  insert into pie.pie_candidate_state as cs
    (user_id, state_version, state, confidence, model_version_id, source_inference_id, calculated_at, updated_at)
  values
    (p_user_id, 1, v_state,
      case when v_accuracy_n >= 6 then least(1.0, v_accuracy_n / 40.0) else null end,
      v_model, v_run, now(), now())
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
$function$;

comment on function pie.rebuild_candidate_state(uuid) is
'PIE candidate state v2.2: distinct observed dimensions, explicit per-dimension counts, missing metrics remain null. Timing is descriptive, confidence alignment is not formal calibration, learning trend is not causal, and this function does not predict AMC readiness or pass probability.';
