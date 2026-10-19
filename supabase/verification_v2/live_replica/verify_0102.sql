-- LOCAL/CI ONLY. Verify unscored confidence observations cannot influence calibration.
\set ON_ERROR_STOP on
do $$
declare
  v_before_estimate numeric;
  v_after_estimate numeric;
  v_before_count integer;
  v_after_count integer;
  v_before_levels jsonb;
  v_after_levels jsonb;
begin
  select
    (state->'mode_evidence'->'normal_mcq'->'calibration'->>'estimate')::numeric,
    (state->'mode_evidence'->'normal_mcq'->'calibration'->>'evidence_count')::integer,
    state->'mode_evidence'->'normal_mcq'->'calibration'->'confidence_level_counts'
  into v_before_estimate, v_before_count, v_before_levels
  from pie.pie_candidate_state
  where user_id='aaaaaaaa-0000-0000-0000-00000000000a';

  if v_before_estimate is null or v_before_count <> 250 then
    raise exception 'FAIL 0102 expected the paired scored calibration baseline';
  end if;

  -- Five confidence-only observations must not alter the paired scored calibration.
  insert into pie.pie_observation(user_id,observation_type,observed_at,payload,provenance)
  select 'aaaaaaaa-0000-0000-0000-00000000000a','MCQ_ATTEMPT',
    now()+g*interval '1 second',
    jsonb_build_object('confidence_level',1,'confidence_normalized',0),
    jsonb_build_object('source','verify_0102_unscored_confidence','synthetic',true,'practice_mode','normal_mcq')
  from generate_series(1,5) g;

  perform pie.rebuild_candidate_state('aaaaaaaa-0000-0000-0000-00000000000a');

  select
    (state->'mode_evidence'->'normal_mcq'->'calibration'->>'estimate')::numeric,
    (state->'mode_evidence'->'normal_mcq'->'calibration'->>'evidence_count')::integer,
    state->'mode_evidence'->'normal_mcq'->'calibration'->'confidence_level_counts'
  into v_after_estimate, v_after_count, v_after_levels
  from pie.pie_candidate_state
  where user_id='aaaaaaaa-0000-0000-0000-00000000000a';

  if v_after_estimate is distinct from v_before_estimate then
    raise exception 'FAIL 0102 unscored confidence changed calibration estimate';
  end if;
  if v_after_count is distinct from v_before_count then
    raise exception 'FAIL 0102 unscored confidence changed paired calibration count';
  end if;
  if v_after_levels is distinct from v_before_levels then
    raise exception 'FAIL 0102 unscored confidence changed confidence-level coverage';
  end if;

  raise notice 'ALL 0102 PAIRED CALIBRATION ASSERTIONS PASSED';
end $$;
