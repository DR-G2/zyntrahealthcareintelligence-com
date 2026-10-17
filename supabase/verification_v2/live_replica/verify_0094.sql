-- LOCAL/CI ONLY. Synthetic candidates are written only to the disposable replica.
\set ON_ERROR_STOP on
\pset footer off

do $$
declare
  v_n integer;
  v_state jsonb;
  v_dimension text;
  v_count integer;
  v_estimate numeric;
  v_lower numeric;
  v_upper numeric;
  v_aligned boolean;
  v_quality numeric;
begin
  foreach v_n in array array[0,1,100,101,250] loop
    delete from pie.pie_observation where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';
    if v_n > 0 then
      insert into pie.pie_observation(user_id, observation_type, observed_at, payload, provenance)
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
        jsonb_build_object('source','verify_0094_synthetic','synthetic',true)
      from generate_series(1, v_n) g;
    end if;

    perform pie.rebuild_candidate_state('aaaaaaaa-0000-0000-0000-00000000000a');
    select state into v_state
      from pie.pie_candidate_state
     where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a';

    if (v_state->>'evidence_count')::int <> v_n then
      raise exception 'FAIL authoritative total count: expected %, got %', v_n, v_state->>'evidence_count';
    end if;
    if (select count(*) from pie.pie_candidate_state
         where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a') <> 1 then
      raise exception 'FAIL expected exactly one candidate state row for N=%', v_n;
    end if;

    foreach v_dimension in array array[
      'capability','decision','timing','calibration','sustained_performance','learning'
    ] loop
      v_count := (v_state->v_dimension->>'evidence_count')::int;
      v_estimate := (v_state->v_dimension->>'estimate')::numeric;
      v_aligned := (v_state->v_dimension->>'estimate_aligned')::boolean;
      if v_count <> v_n then
        raise exception 'FAIL % evidence count at N=%: got %', v_dimension, v_n, v_count;
      end if;
      if v_aligned is distinct from true then
        raise exception 'FAIL % estimator alignment at N=%', v_dimension, v_n;
      end if;
      if v_n > 0 then
        v_quality := (v_state->v_dimension->>'evidence_quality')::numeric;
        v_lower := (v_state->v_dimension->>'lower')::numeric;
        v_upper := (v_state->v_dimension->>'upper')::numeric;
        if v_quality <> 1 then
          raise exception 'FAIL % evidence quality at N=%: got %', v_dimension, v_n, v_quality;
        end if;
        if (v_state->v_dimension->>'uncertainty') is null
           or v_lower < 0 or v_upper > 1 or v_lower > v_estimate or v_estimate > v_upper then
          raise exception 'FAIL % interval invalid at N=%', v_dimension, v_n;
        end if;
      else
        if (v_state->v_dimension->>'uncertainty') is not null
           or (v_state->v_dimension->>'lower') is not null
           or (v_state->v_dimension->>'upper') is not null then
          raise exception 'FAIL empty evidence must not emit an interval for %', v_dimension;
        end if;
      end if;
    end loop;
    raise notice 'PASS N=%: all six dimensions have full-history counts and aligned interval semantics', v_n;
  end loop;

  -- Candidate B must not affect candidate A.
  delete from pie.pie_observation where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  insert into pie.pie_observation(user_id, observation_type, observed_at, payload, provenance)
  select 'bbbbbbbb-0000-0000-0000-00000000000b', 'MCQ_ATTEMPT',
         now() + (g * interval '1 second'),
         jsonb_build_object('outcome','CORRECT','confidence_normalized',1,
                            'time_total_ms',10000,'answer_changes',0),
         jsonb_build_object('source','verify_0094_synthetic','synthetic',true)
    from generate_series(1,7) g;
  perform pie.rebuild_candidate_state('bbbbbbbb-0000-0000-0000-00000000000b');
  if (select (state->>'evidence_count')::int from pie.pie_candidate_state
       where user_id='bbbbbbbb-0000-0000-0000-00000000000b') <> 7 then
    raise exception 'FAIL candidate B count';
  end if;
  if (select (state->>'evidence_count')::int from pie.pie_candidate_state
       where user_id='aaaaaaaa-0000-0000-0000-00000000000a') <> 250 then
    raise exception 'FAIL candidate isolation: A changed while rebuilding B';
  end if;
  raise notice 'PASS candidate isolation: A=250, B=7';
end $$;
