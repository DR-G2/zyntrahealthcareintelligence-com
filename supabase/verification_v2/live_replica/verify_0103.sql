-- LOCAL/CI ONLY. Verify mode- and dimension-scoped latest valid observation timestamps.
\set ON_ERROR_STOP on
do $$
declare
  v_state jsonb;
  v_normal jsonb;
  v_nudge jsonb;
  v_amc jsonb;
  v_expected_normal timestamptz := timestamptz '2026-01-01 00:00:00+00' + interval '250 seconds';
  v_expected_nudge timestamptz := timestamptz '2026-02-01 00:00:00+00' + interval '7 seconds';
begin
  select state into v_state
  from pie.pie_candidate_state
  where user_id='aaaaaaaa-0000-0000-0000-00000000000a';
  if v_state is null then raise exception 'FAIL 0103 candidate state missing'; end if;
  v_normal := v_state->'mode_evidence'->'normal_mcq';
  v_nudge := v_state->'mode_evidence'->'nudge';
  v_amc := v_state->'mode_evidence'->'amc_exam';

  foreach v_state in array array[]::jsonb[] loop
    null;
  end loop;

  if (v_normal->'capability'->>'latest_observation_at')::timestamptz is distinct from v_expected_normal then
    raise exception 'FAIL 0103 capability timestamp not latest valid Normal MCQ observation';
  end if;
  if (v_normal->'decision'->>'latest_observation_at')::timestamptz is distinct from v_expected_normal then
    raise exception 'FAIL 0103 decision timestamp not dimension-specific';
  end if;
  if (v_normal->'timing'->>'latest_observation_at')::timestamptz is distinct from v_expected_normal then
    raise exception 'FAIL 0103 timing timestamp not dimension-specific';
  end if;
  if (v_normal->'calibration'->>'latest_observation_at')::timestamptz is distinct from v_expected_normal then
    raise exception 'FAIL 0103 calibration timestamp not paired and mode-scoped';
  end if;
  if (v_nudge->'capability'->>'latest_observation_at')::timestamptz is distinct from v_expected_nudge then
    raise exception 'FAIL 0103 Nudge timestamp was mixed with Normal MCQ';
  end if;
  if v_amc->'capability'->>'latest_observation_at' is not null then
    raise exception 'FAIL 0103 empty AMC Exam mode must not inherit another mode timestamp';
  end if;
  raise notice 'ALL 0103 MODE-SCOPED TIMESTAMP ASSERTIONS PASSED';
end $$;
