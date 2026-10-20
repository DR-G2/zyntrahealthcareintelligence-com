-- LOCAL/CI ONLY. Verify mode- and dimension-scoped latest valid observation timestamps.
\set ON_ERROR_STOP on
do $$
declare
  v_state jsonb;
  v_normal jsonb;
  v_nudge jsonb;
  v_amc jsonb;
  v_expected_capability timestamptz;
  v_expected_decision timestamptz;
  v_expected_timing timestamptz;
  v_expected_calibration timestamptz;
  v_expected_nudge timestamptz := timestamptz '2026-02-01 00:00:00+00' + interval '7 seconds';
begin
  select state into v_state
  from pie.pie_candidate_state
  where user_id='aaaaaaaa-0000-0000-0000-00000000000a';
  if v_state is null then raise exception 'FAIL 0103 candidate state missing'; end if;

  select max(o.observed_at) into v_expected_capability
  from pie.pie_observation o
  where o.user_id='aaaaaaaa-0000-0000-0000-00000000000a'
    and o.provenance->>'practice_mode'='normal_mcq'
    and o.payload->>'outcome' in ('CORRECT','INCORRECT');

  select max(o.observed_at) into v_expected_decision
  from pie.pie_observation o
  where o.user_id='aaaaaaaa-0000-0000-0000-00000000000a'
    and o.provenance->>'practice_mode'='normal_mcq'
    and case
      when coalesce(o.payload->>'answer_changes','') ~ '^[0-9]+([.][0-9]+)?$'
        then (o.payload->>'answer_changes')::numeric >= 0
      else false
    end;

  select max(o.observed_at) into v_expected_timing
  from pie.pie_observation o
  where o.user_id='aaaaaaaa-0000-0000-0000-00000000000a'
    and o.provenance->>'practice_mode'='normal_mcq'
    and case
      when coalesce(o.payload->>'time_total_ms','') ~ '^[0-9]+([.][0-9]+)?$'
        then (o.payload->>'time_total_ms')::numeric > 0
      else false
    end;

  select max(o.observed_at) into v_expected_calibration
  from pie.pie_observation o
  where o.user_id='aaaaaaaa-0000-0000-0000-00000000000a'
    and o.provenance->>'practice_mode'='normal_mcq'
    and o.payload->>'outcome' in ('CORRECT','INCORRECT')
    and case
      when coalesce(o.payload->>'confidence_level','') ~ '^[1-5]$' then true
      when coalesce(o.payload->>'confidence_normalized','') ~ '^[0-9]+([.][0-9]+)?$'
        then (o.payload->>'confidence_normalized')::numeric between 0 and 1
      else false
    end;

  v_normal := v_state->'mode_evidence'->'normal_mcq';
  v_nudge := v_state->'mode_evidence'->'nudge';
  v_amc := v_state->'mode_evidence'->'amc_exam';

  if (v_normal->'capability'->>'latest_observation_at')::timestamptz is distinct from v_expected_capability then
    raise exception 'FAIL 0103 capability timestamp: expected %, got %', v_expected_capability, v_normal->'capability'->>'latest_observation_at';
  end if;
  if (v_normal->'decision'->>'latest_observation_at')::timestamptz is distinct from v_expected_decision then
    raise exception 'FAIL 0103 decision timestamp: expected %, got %', v_expected_decision, v_normal->'decision'->>'latest_observation_at';
  end if;
  if (v_normal->'timing'->>'latest_observation_at')::timestamptz is distinct from v_expected_timing then
    raise exception 'FAIL 0103 timing timestamp: expected %, got %', v_expected_timing, v_normal->'timing'->>'latest_observation_at';
  end if;
  if (v_normal->'calibration'->>'latest_observation_at')::timestamptz is distinct from v_expected_calibration then
    raise exception 'FAIL 0103 calibration timestamp: expected %, got %', v_expected_calibration, v_normal->'calibration'->>'latest_observation_at';
  end if;
  if (v_nudge->'capability'->>'latest_observation_at')::timestamptz is distinct from v_expected_nudge then
    raise exception 'FAIL 0103 Nudge timestamp was mixed with Normal MCQ';
  end if;
  if v_amc->'capability'->>'latest_observation_at' is not null then
    raise exception 'FAIL 0103 empty AMC Exam mode must not inherit another mode timestamp';
  end if;
  raise notice 'ALL 0103 MODE- AND DIMENSION-SCOPED TIMESTAMP ASSERTIONS PASSED';
end $$;
