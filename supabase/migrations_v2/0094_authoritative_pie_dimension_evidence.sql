-- 0094: Attach full-history evidence metadata to authoritative PIE dimensions.
-- Metadata is computed from the same full-history signals used by the authoritative
-- candidate-state estimator. Intervals are emitted only when the persisted estimate
-- matches that estimator; stale estimates are preserved and their intervals stay NULL.
-- Never reads shadow inference tables. No production migration is applied by this change.
begin;

do $$
begin
  if to_regclass('pie.pie_candidate_state') is null
     or to_regclass('pie.pie_observation') is null then
    raise exception '0094 preflight: authoritative PIE tables are missing';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'pie' and table_name = 'pie_candidate_state'
        and column_name in ('user_id','state')) <> 2 then
    raise exception '0094 preflight: candidate-state columns differ from expected contract';
  end if;
end $$;

create or replace function pie._authoritative_dimension_evidence(
  p_user_id uuid,
  p_dimension text,
  p_estimate numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_stats jsonb;
  v_count integer := 0;
  v_quality numeric;
  v_radius numeric;
  v_estimator numeric;
  v_aligned boolean := false;
  v_outcome_count integer := 0;
  v_decision_count integer := 0;
  v_timing_count integer := 0;
  v_confidence_count integer := 0;
  v_calibration_count integer := 0;
  v_outcome_mean numeric;
  v_decision_mean numeric;
  v_timing_mean numeric;
  v_confidence_mean numeric;
  v_outcome_quality numeric;
  v_decision_quality numeric;
  v_timing_quality numeric;
  v_calibration_quality numeric;
begin
  if p_user_id is null or p_dimension not in
    ('capability','decision','timing','calibration','sustained_performance','learning') then
    raise exception 'Invalid authoritative PIE dimension request';
  end if;

  -- Use the full eligible observation history, matching the authoritative v2.1 rebuild.
  -- The quality score is descriptive metadata; the estimator itself preserves the
  -- deployed model's signal definitions and does not silently reweight its estimate.
  with signals as (
    select
      o.payload,
      case
        when o.payload->>'observation_quality' = 'UNUSABLE' then 0::numeric
        when o.payload->>'observation_quality' = 'CONTRADICTORY' then 0.15::numeric
        when o.payload->>'observation_quality' = 'SUSPICIOUS' then 0.5::numeric
        when o.payload->>'interaction_state' = 'INTERRUPTED' then 0.25::numeric
        else 1::numeric
      end as quality,
      case o.payload->>'outcome'
        when 'CORRECT' then 1::numeric
        when 'INCORRECT' then 0::numeric
        else null::numeric
      end as outcome_signal,
      case
        when coalesce(o.payload->>'confidence_normalized','') ~ '^[0-9]+([.][0-9]+)?$'
          and (o.payload->>'confidence_normalized')::numeric between 0 and 1
        then (o.payload->>'confidence_normalized')::numeric
        else null::numeric
      end as confidence_signal,
      case
        when coalesce(o.payload->>'time_total_ms','') ~ '^[0-9]+([.][0-9]+)?$'
          and (o.payload->>'time_total_ms')::numeric > 0
        then 1 / (1 + ln(1 + (o.payload->>'time_total_ms')::numeric / 1000) / 10)
        else null::numeric
      end as timing_signal,
      case
        when coalesce(o.payload->>'answer_changes','') ~ '^[0-9]+([.][0-9]+)?$'
          and (o.payload->>'answer_changes')::numeric >= 0
        then least(1::numeric, greatest(0::numeric, 1 - (o.payload->>'answer_changes')::numeric / 3))
        else 1::numeric
      end as decision_signal
    from pie.pie_observation o
    where o.user_id = p_user_id
  )
  select jsonb_build_object(
    'total_count', count(*),
    'outcome_count', count(*) filter (where outcome_signal is not null),
    'outcome_mean', avg(outcome_signal),
    'outcome_quality', avg(quality) filter (where outcome_signal is not null),
    'decision_count', count(*),
    'decision_mean', avg(decision_signal),
    'decision_quality', avg(quality),
    'timing_count', count(*) filter (where timing_signal is not null),
    'timing_mean', avg(timing_signal),
    'timing_quality', avg(quality) filter (where timing_signal is not null),
    'confidence_count', count(*) filter (where confidence_signal is not null),
    'confidence_mean', avg(confidence_signal),
    'calibration_count', count(*) filter (where confidence_signal is not null and outcome_signal is not null),
    'calibration_quality', avg(quality) filter (where confidence_signal is not null and outcome_signal is not null)
  )
  into v_stats
  from signals;

  v_outcome_count := (v_stats->>'outcome_count')::integer;
  v_decision_count := (v_stats->>'decision_count')::integer;
  v_timing_count := (v_stats->>'timing_count')::integer;
  v_confidence_count := (v_stats->>'confidence_count')::integer;
  v_calibration_count := (v_stats->>'calibration_count')::integer;
  v_outcome_mean := nullif(v_stats->>'outcome_mean','')::numeric;
  v_decision_mean := nullif(v_stats->>'decision_mean','')::numeric;
  v_timing_mean := nullif(v_stats->>'timing_mean','')::numeric;
  v_confidence_mean := nullif(v_stats->>'confidence_mean','')::numeric;
  v_outcome_quality := nullif(v_stats->>'outcome_quality','')::numeric;
  v_decision_quality := nullif(v_stats->>'decision_quality','')::numeric;
  v_timing_quality := nullif(v_stats->>'timing_quality','')::numeric;
  v_calibration_quality := nullif(v_stats->>'calibration_quality','')::numeric;

  if p_dimension in ('capability','sustained_performance','learning') then
    v_count := v_outcome_count;
    v_quality := v_outcome_quality;
    v_estimator := round(coalesce(v_outcome_mean, 0::numeric), 4);
    v_aligned := p_estimate is not null and p_estimate = v_estimator;
    -- Hoeffding two-sided 95% bound for the same bounded outcome mean used by PIE.
    if v_aligned and v_count > 0 then
      v_radius := least(1::numeric, sqrt(ln(40::numeric) / (2 * v_count)));
    end if;
  elsif p_dimension = 'decision' then
    v_count := v_decision_count;
    v_quality := v_decision_quality;
    v_estimator := round(coalesce(v_decision_mean, 0.5::numeric), 4);
    v_aligned := p_estimate is not null and p_estimate = v_estimator;
    if v_aligned and v_count > 0 then
      v_radius := least(1::numeric, sqrt(ln(40::numeric) / (2 * v_count)));
    end if;
  elsif p_dimension = 'timing' then
    v_count := v_timing_count;
    v_quality := v_timing_quality;
    v_estimator := round(coalesce(v_timing_mean, 0.5::numeric), 4);
    v_aligned := p_estimate is not null and p_estimate = v_estimator;
    if v_aligned and v_count > 0 then
      v_radius := least(1::numeric, sqrt(ln(40::numeric) / (2 * v_count)));
    end if;
  elsif p_dimension = 'calibration' then
    v_count := v_calibration_count;
    v_quality := v_calibration_quality;
    v_estimator := round(1 - abs(coalesce(v_confidence_mean, 0.5::numeric) - coalesce(v_outcome_mean, 0::numeric)), 4);
    v_aligned := p_estimate is not null and p_estimate = v_estimator;
    -- Union bound over the confidence and outcome means. This interval is valid only
    -- when both means have observations and the stored estimate matches their formula.
    if v_aligned and v_confidence_count > 0 and v_outcome_count > 0 then
      v_radius := least(1::numeric,
        sqrt(ln(80::numeric) / (2 * v_confidence_count))
        + sqrt(ln(80::numeric) / (2 * v_outcome_count)));
    end if;
  end if;

  return jsonb_build_object(
    'evidence_count', v_count,
    'evidence_quality', case when v_count > 0 then round(v_quality, 6) else null end,
    'estimate_aligned', v_aligned,
    'uncertainty', case when v_radius is not null then round(v_radius, 6) else null end,
    'lower', case when v_radius is not null and p_estimate is not null then round(greatest(0::numeric, p_estimate - v_radius), 6) else null end,
    'upper', case when v_radius is not null and p_estimate is not null then round(least(1::numeric, p_estimate + v_radius), 6) else null end
  );
end;
$$;

revoke all on function pie._authoritative_dimension_evidence(uuid,text,numeric) from public, anon, authenticated, service_role;

create or replace function pie._attach_authoritative_dimension_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dimension text;
  v_dimension_state jsonb;
  v_estimate numeric;
  v_metadata jsonb;
begin
  foreach v_dimension in array array[
    'capability','decision','timing','calibration','sustained_performance','learning'
  ] loop
    v_dimension_state := coalesce(new.state->v_dimension, '{}'::jsonb);
    v_estimate := null;
    if coalesce(v_dimension_state->>'estimate','') ~ '^[0-9]+([.][0-9]+)?$'
      and (v_dimension_state->>'estimate')::numeric between 0 and 1 then
      v_estimate := (v_dimension_state->>'estimate')::numeric;
    end if;
    v_metadata := pie._authoritative_dimension_evidence(new.user_id, v_dimension, v_estimate);
    new.state := jsonb_set(new.state, array[v_dimension], v_dimension_state || v_metadata, true);
  end loop;
  return new;
end;
$$;

revoke all on function pie._attach_authoritative_dimension_evidence() from public, anon, authenticated, service_role;

drop trigger if exists pie_candidate_state_dimension_evidence on pie.pie_candidate_state;
create trigger pie_candidate_state_dimension_evidence
before insert or update of state, user_id on pie.pie_candidate_state
for each row execute function pie._attach_authoritative_dimension_evidence();

-- Backfill metadata. Estimates are never changed; stale estimates get estimate_aligned=false
-- and no interval until the next authoritative rebuild brings them into alignment.
update pie.pie_candidate_state set state = state;

comment on function pie._authoritative_dimension_evidence(uuid,text,numeric) is
  'Computes full-history evidence metadata from authoritative observations only. Intervals require exact estimator alignment; shadow inference is never read.';
comment on trigger pie_candidate_state_dimension_evidence on pie.pie_candidate_state is
  'Persists full-history dimension evidence metadata on authoritative candidate-state rebuilds.';

notify pgrst, 'reload schema';
commit;
