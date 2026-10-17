-- LOCAL ONLY: regression test for migration 0088 full-history candidate state.
-- Run only on the disposable live-schema replica created by replay.sh. Never run on production.
-- Requires replay.sh --with-0044 and migration 0088 already applied.
\set ON_ERROR_STOP on
\pset footer off
\set A 'aaaaaaaa-0000-0000-0000-00000000000a'
\set B 'bbbbbbbb-0000-0000-0000-00000000000b'

-- Helper: clear test observations and rebuild A with exactly N observations.
-- Each case asserts the stored evidence_count equals N, including >100.
do $$
declare
  v_n integer;
  v_actual integer;
  v_version integer;
  v_first_state jsonb;
  v_second_state jsonb;
  v_state_id uuid;
begin
  foreach v_n in array array[0,1,100,101,250] loop
    delete from pie.pie_observation where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';
    if v_n > 0 then
      insert into pie.pie_observation
        (user_id, observation_type, observed_at, payload, provenance)
      select
        'aaaaaaaa-0000-0000-0000-00000000000a',
        'MCQ_ATTEMPT',
        timestamptz '2026-01-01 00:00:00+00' + (g * interval '1 second'),
        jsonb_build_object(
          'outcome', case when g % 2 = 0 then 'CORRECT' else 'INCORRECT' end,
          'confidence_normalized', 0.75,
          'time_total_ms', 30000,
          'answer_changes', 1
        ),
        jsonb_build_object('source','verify_0088_synthetic','synthetic',true)
      from generate_series(1, v_n) g;
    end if;

    v_state_id := pie.rebuild_candidate_state('aaaaaaaa-0000-0000-0000-00000000000a');
    select (state->>'evidence_count')::int, state_version, state
      into v_actual, v_version, v_first_state
      from pie.pie_candidate_state
     where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';
    if v_actual <> v_n then
      raise exception 'FAIL count case %: expected %, got %', v_n, v_n, v_actual;
    end if;

    -- Migration 0094 must attach metadata from the same full-history estimator.
    if (v_first_state->'capability'->>'evidence_count')::int <> v_n
       or (v_first_state->'decision'->>'evidence_count')::int <> v_n
       or (v_first_state->'timing'->>'evidence_count')::int <> v_n
       or (v_first_state->'calibration'->>'evidence_count')::int <> v_n
       or (v_first_state->'sustained_performance'->>'evidence_count')::int <> v_n
       or (v_first_state->'learning'->>'evidence_count')::int <> v_n then
      raise exception 'FAIL dimension evidence counts for observation case %', v_n;
    end if;
    if v_n > 0 and (
       coalesce((v_first_state->'capability'->>'estimate_aligned')::boolean,false) is not true
       or coalesce((v_first_state->'decision'->>'estimate_aligned')::boolean,false) is not true
       or coalesce((v_first_state->'timing'->>'estimate_aligned')::boolean,false) is not true
       or coalesce((v_first_state->'calibration'->>'estimate_aligned')::boolean,false) is not true
       or (v_first_state->'capability'->>'uncertainty') is null
       or (v_first_state->'decision'->>'uncertainty') is null
       or (v_first_state->'timing'->>'uncertainty') is null
       or (v_first_state->'calibration'->>'uncertainty') is null
       or (v_first_state->'capability'->>'evidence_quality')::numeric <> 1
       or (v_first_state->'decision'->>'evidence_quality')::numeric <> 1
       or (v_first_state->'timing'->>'evidence_quality')::numeric <> 1
       or (v_first_state->'calibration'->>'evidence_quality')::numeric <> 1
    ) then
      raise exception 'FAIL dimension metadata/alignment for observation case %', v_n;
    end if;

    -- Same inputs should produce same estimates on repeated rebuilds.
    perform pie.rebuild_candidate_state('aaaaaaaa-0000-0000-0000-00000000000a');
    select jsonb_build_object(
             'capability', state->'capability',
             'decision', state->'decision',
             'timing', state->'timing',
             'calibration', state->'calibration',
             'evidence_count', state->'evidence_count'
           )
      into v_second_state
      from pie.pie_candidate_state
     where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';
    if (v_first_state->'capability') is distinct from (v_second_state->'capability')
       or (v_first_state->'decision') is distinct from (v_second_state->'decision')
       or (v_first_state->'timing') is distinct from (v_second_state->'timing')
       or (v_first_state->'calibration') is distinct from (v_second_state->'calibration')
       or (v_first_state->'evidence_count') is distinct from (v_second_state->'evidence_count') then
      raise exception 'FAIL determinism case %: estimates changed on repeat rebuild', v_n;
    end if;

    if (select count(*) from pie.pie_candidate_state
         where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a') <> 1 then
      raise exception 'FAIL case %: expected exactly one candidate state row', v_n;
    end if;
    raise notice 'PASS evidence_count=% (repeat rebuild deterministic)', v_n;
  end loop;

  -- Separate candidate must only use its own observations.
  delete from pie.pie_observation where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  insert into pie.pie_observation
    (user_id, observation_type, observed_at, payload, provenance)
  select 'bbbbbbbb-0000-0000-0000-00000000000b', 'MCQ_ATTEMPT',
         now() + (g * interval '1 second'),
         jsonb_build_object('outcome','CORRECT','confidence_normalized',1,
                            'time_total_ms',10000,'answer_changes',0),
         jsonb_build_object('source','verify_0088_synthetic','synthetic',true)
    from generate_series(1,7) g;
  perform pie.rebuild_candidate_state('bbbbbbbb-0000-0000-0000-00000000000b');
  if (select (state->>'evidence_count')::int from pie.pie_candidate_state
       where user_id='bbbbbbbb-0000-0000-0000-00000000000b') <> 7 then
    raise exception 'FAIL candidate B evidence count';
  end if;
  if (select (state->>'evidence_count')::int from pie.pie_candidate_state
       where user_id='aaaaaaaa-0000-0000-0000-00000000000a') <> 250 then
    raise exception 'FAIL candidate isolation: A changed while rebuilding B';
  end if;
  raise notice 'PASS candidate isolation: A=250, B=7';
end $$;

-- Report model + test-state summary. Synthetic rows remain only in this disposable DB.
select model_key, version, status, config
from pie.pie_model_version
where model_key='candidate-state' and version='v2.1';
select user_id, state_version, state->>'evidence_count' as evidence_count,
       state->>'evidence_level' as evidence_level
from pie.pie_candidate_state
where user_id in ('aaaaaaaa-0000-0000-0000-00000000000a',
                  'bbbbbbbb-0000-0000-0000-00000000000b')
order by user_id;
