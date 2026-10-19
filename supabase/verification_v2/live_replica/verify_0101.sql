-- LOCAL/CI ONLY. Mode-specific PIE regression on disposable replica.
\set ON_ERROR_STOP on
do $$
declare
  v_state jsonb;
  v_normal jsonb;
  v_nudge jsonb;
  v_sparse jsonb;
  v_confidence jsonb;
begin
  delete from pie.pie_observation where user_id in (
    'aaaaaaaa-0000-0000-0000-00000000000a',
    'bbbbbbbb-0000-0000-0000-00000000000b'
  );

  insert into pie.pie_observation(user_id,observation_type,observed_at,payload,provenance)
  select 'aaaaaaaa-0000-0000-0000-00000000000a','MCQ_ATTEMPT',
    timestamptz '2026-01-01 00:00:00+00' + (g * interval '1 second'),
    jsonb_build_object(
      'practice_mode','normal_mcq',
      'outcome',case when g % 2 = 0 then 'CORRECT' else 'INCORRECT' end,
      'confidence_level',((g-1)%5)+1,
      'confidence_normalized',(((g-1)%5)::numeric)/4,
      'time_total_ms',30000,
      'answer_changes',1
    ),
    jsonb_build_object('source','verify_0101_synthetic','synthetic',true,'practice_mode','normal_mcq')
  from generate_series(1,250) g;

  insert into pie.pie_observation(user_id,observation_type,observed_at,payload,provenance)
  select 'aaaaaaaa-0000-0000-0000-00000000000a','MCQ_ATTEMPT',
    timestamptz '2026-02-01 00:00:00+00' + (g * interval '1 second'),
    jsonb_build_object('practice_mode','nudge','outcome','CORRECT','confidence_level',5,
      'confidence_normalized',1,'time_total_ms',20000,'answer_changes',0),
    jsonb_build_object('source','verify_0101_synthetic','synthetic',true,'practice_mode','nudge')
  from generate_series(1,7) g;

  -- Untagged legacy observations must not be guessed into either mode.
  insert into pie.pie_observation(user_id,observation_type,observed_at,payload,provenance)
  select 'aaaaaaaa-0000-0000-0000-00000000000a','MCQ_ATTEMPT',now()+g*interval '1 second',
    jsonb_build_object('practice_mode','normal_mcq','outcome','CORRECT','confidence_normalized',1,'time_total_ms',10000,'answer_changes',0),
    jsonb_build_object('source','verify_0101_ambiguous','synthetic',true)
  from generate_series(1,3) g;

  perform pie.rebuild_candidate_state('aaaaaaaa-0000-0000-0000-00000000000a');
  select state into v_state from pie.pie_candidate_state where user_id='aaaaaaaa-0000-0000-0000-00000000000a';
  v_normal := v_state->'mode_evidence'->'normal_mcq';
  v_nudge := v_state->'mode_evidence'->'nudge';

  if (v_normal->'capability'->>'evidence_count')::int <> 250 then raise exception 'FAIL normal MCQ capability count was not mode-scoped'; end if;
  if (v_normal->'decision'->>'evidence_count')::int <> 250 then raise exception 'FAIL normal MCQ decision count was not mode-scoped'; end if;
  if (v_normal->'timing'->>'evidence_count')::int <> 250 then raise exception 'FAIL normal MCQ timing count was not mode-scoped'; end if;
  if (v_normal->'calibration'->>'evidence_count')::int <> 250 then raise exception 'FAIL normal MCQ calibration count was not mode-scoped'; end if;
  if (v_normal->'calibration'->>'calibration_ready')::boolean is distinct from true then raise exception 'FAIL calibration readiness did not pass 15-per-level gate'; end if;
  v_confidence := v_normal->'calibration'->'confidence_level_counts';
  if (v_confidence->>'1')::int <> 50 or (v_confidence->>'2')::int <> 50 or (v_confidence->>'3')::int <> 50
     or (v_confidence->>'4')::int <> 50 or (v_confidence->>'5')::int <> 50 then
    raise exception 'FAIL confidence-level coverage counts';
  end if;
  if (v_nudge->'capability'->>'evidence_count')::int <> 7 then raise exception 'FAIL Nudge evidence was mixed with Normal MCQ'; end if;
  if (v_nudge->'calibration'->>'calibration_ready')::boolean is distinct from false
     or v_nudge->'calibration'->>'estimate' is not null then
    raise exception 'FAIL Nudge calibration estimate escaped sparse evidence gate';
  end if;
  if (v_state->'mode_evidence'->'amc_exam'->'capability'->>'evidence_count')::int <> 0 then
    raise exception 'FAIL AMC Exam mode inherited other mode evidence';
  end if;

  insert into pie.pie_observation(user_id,observation_type,observed_at,payload,provenance)
  select 'bbbbbbbb-0000-0000-0000-00000000000b','MCQ_ATTEMPT',
    timestamptz '2026-03-01 00:00:00+00' + (g * interval '1 second'),
    jsonb_build_object('practice_mode','normal_mcq','outcome','CORRECT',
      'confidence_level',((g-1)%5)+1,'confidence_normalized',(((g-1)%5)::numeric)/4,
      case when g=50 then 'unused' else 'time_total_ms' end,case when g=50 then null else 30000 end,
      case when g=50 then 'unused' else 'answer_changes' end,case when g=50 then null else 1 end),
    jsonb_build_object('source','verify_0101_sparse','synthetic',true,'practice_mode','normal_mcq')
  from generate_series(1,50) g;

  perform pie.rebuild_candidate_state('bbbbbbbb-0000-0000-0000-00000000000b');
  select state->'mode_evidence'->'normal_mcq' into v_sparse
    from pie.pie_candidate_state where user_id='bbbbbbbb-0000-0000-0000-00000000000b';
  if (v_sparse->'capability'->>'evidence_count')::int <> 50 then raise exception 'FAIL sparse capability valid count'; end if;
  if (v_sparse->'timing'->>'evidence_count')::int <> 49 then raise exception 'FAIL missing timing counted as valid evidence'; end if;
  if (v_sparse->'decision'->>'evidence_count')::int <> 49 then raise exception 'FAIL missing answer-change counted as valid evidence'; end if;
  if (v_sparse->'calibration'->>'calibration_ready')::boolean is distinct from false
     or v_sparse->'calibration'->>'estimate' is not null then
    raise exception 'FAIL calibration must require 15 valid answers at every confidence level';
  end if;
  raise notice 'ALL 0101 MODE ISOLATION, MISSING-SIGNAL AND CALIBRATION ASSERTIONS PASSED';
end $$;
