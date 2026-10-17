-- 0094: Add evidence-derived uncertainty metadata to authoritative PIE state.
-- This migration does not read or copy pie.inference_shadow / pie.inference_projection.
-- Existing estimates remain unchanged. Metadata is calculated only from the authoritative
-- observation stream and persisted alongside each dimension estimate.
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
  v_effective_n numeric;
  v_conf_effective_n numeric;
  v_outcome_effective_n numeric;
  v_radius numeric;
  v_sum_quality numeric;
  v_sum_quality_sq numeric;
begin
  if p_user_id is null or p_dimension not in
    ('capability','decision','timing','calibration','sustained_performance','learning') then
    raise exception 'Invalid authoritative PIE dimension request';
  end if;

  with recent as (
    select o.payload
    from pie.pie_observation o
    where o.user_id = p_user_id
    order by o.observed_at desc, o.id desc
    limit 100
  ),
  signals as (
    select
      payload,
      case
        when payload->>'observation_quality' = 'UNUSABLE' then 0::numeric
        when payload->>'observation_quality' = 'CONTRADICTORY' then 0.15::numeric
        when payload->>'observation_quality' = 'SUSPICIOUS' then 0.5::numeric
        when payload->>'interaction_state' = 'INTERRUPTED' then 0.25::numeric
        else 1::numeric
      end as quality,
      case payload->>'outcome'
        when 'CORRECT' then 1::numeric
        when 'INCORRECT' then 0::numeric
        else null::numeric
      end as outcome_signal,
      case
        when coalesce(payload->>'confidence_normalized','') ~ '^[0-9]+(\\.[0-9]+)?$'
          and (payload->>'confidence_normalized')::numeric between 0 and 1
        then (payload->>'confidence_normalized')::numeric
        else null::numeric
      end as confidence_signal,
      case
        when coalesce(payload->>'time_total_ms','') ~ '^[0-9]+(\\.[0-9]+)?$'
          and (payload->>'time_total_ms')::numeric > 0
        then 1 / (1 + ln(1 + (payload->>'time_total_ms')::numeric / 1000) / 10)
        else null::numeric
      end as timing_signal,
      case
        when coalesce(payload->>'answer_changes','') ~ '^[0-9]+(\\.[0-9]+)?$'
          and (payload->>'answer_changes')::numeric >= 0
        then least(1::numeric, greatest(0::numeric, 1 - (payload->>'answer_changes')::numeric / 3))
        else null::numeric
      end as decision_signal
    from recent
  )
  select jsonb_build_object(
    'outcome_count', count(*) filter (where outcome_signal is not null),
    'outcome_quality', avg(quality) filter (where outcome_signal is not null),
    'outcome_sum_q', coalesce(sum(quality) filter (where outcome_signal is not null), 0),
    'outcome_sum_q2', coalesce(sum(quality * quality) filter (where outcome_signal is not null), 0),
    'confidence_count', count(*) filter (where confidence_signal is not null),
    'confidence_sum_q', coalesce(sum(quality) filter (where confidence_signal is not null), 0),
    'confidence_sum_q2', coalesce(sum(quality * quality) filter (where confidence_signal is not null), 0),
    'decision_count', count(*) filter (where decision_signal is not null),
    'decision_quality', avg(quality) filter (where decision_signal is not null),
    'decision_sum_q', coalesce(sum(quality) filter (where decision_signal is not null), 0),
    'decision_sum_q2', coalesce(sum(quality * quality) filter (where decision_signal is not null), 0),
    'timing_count', count(*) filter (where timing_signal is not null),
    'timing_quality', avg(quality) filter (where timing_signal is not null),
    'timing_sum_q', coalesce(sum(quality) filter (where timing_signal is not null), 0),
    'timing_sum_q2', coalesce(sum(quality * quality) filter (where timing_signal is not null), 0),
    'calibration_count', count(*) filter (where confidence_signal is not null and outcome_signal is not null),
    'calibration_quality', avg(quality) filter (where confidence_signal is not null and outcome_signal is not null)
  )
  into v_stats
  from signals;

  if p_dimension in ('capability','sustained_performance','learning') then
    v_count := (v_stats->>'outcome_count')::integer;
    v_quality := nullif(v_stats->>'outcome_quality','')::numeric;
    v_sum_quality := (v_stats->>'outcome_sum_q')::numeric;
    v_sum_quality_sq := (v_stats->>'outcome_sum_q2')::numeric;
    v_effective_n := case when v_sum_quality_sq > 0 then v_sum_quality * v_sum_quality / v_sum_quality_sq else 0 end;
    if v_effective_n > 0 then v_radius := least(1::numeric, sqrt(ln(40::numeric) / (2 * v_effective_n))); end if;
  elsif p_dimension = 'decision' then
    v_count := (v_stats->>'decision_count')::integer;
    v_quality := nullif(v_stats->>'decision_quality','')::numeric;
    v_sum_quality := (v_stats->>'decision_sum_q')::numeric;
    v_sum_quality_sq := (v_stats->>'decision_sum_q2')::numeric;
    v_effective_n := case when v_sum_quality_sq > 0 then v_sum_quality * v_sum_quality / v_sum_quality_sq else 0 end;
    if v_effective_n > 0 then v_radius := least(1::numeric, sqrt(ln(40::numeric) / (2 * v_effective_n))); end if;
  elsif p_dimension = 'timing' then
    v_count := (v_stats->>'timing_count')::integer;
    v_quality := nullif(v_stats->>'timing_quality','')::numeric;
    v_sum_quality := (v_stats->>'timing_sum_q')::numeric;
    v_sum_quality_sq := (v_stats->>'timing_sum_q2')::numeric;
    v_effective_n := case when v_sum_quality_sq > 0 then v_sum_quality * v_sum_quality / v_sum_quality_sq else 0 end;
    if v_effective_n > 0 then v_radius := least(1::numeric, sqrt(ln(40::numeric) / (2 * v_effective_n))); end if;
  elsif p_dimension = 'calibration' then
    v_count := (v_stats->>'calibration_count')::integer;
    v_quality := nullif(v_stats->>'calibration_quality','')::numeric;
    v_sum_quality := (v_stats->>'confidence_sum_q')::numeric;
    v_sum_quality_sq := (v_stats->>'confidence_sum_q2')::numeric;
    v_conf_effective_n := case when v_sum_quality_sq > 0 then v_sum_quality * v_sum_quality / v_sum_quality_sq else 0 end;
    v_sum_quality := (v_stats->>'outcome_sum_q')::numeric;
    v_sum_quality_sq := (v_stats->>'outcome_sum_q2')::numeric;
    v_outcome_effective_n := case when v_sum_quality_sq > 0 then v_sum_quality * v_sum_quality / v_sum_quality_sq else 0 end;
    if v_conf_effective_n > 0 and v_outcome_effective_n > 0 then
      -- Conservative 95% bound for 1 - |mean confidence - mean outcome| via a
      -- union bound over the two bounded means. This is not the shadow model's interval.
      v_radius := least(1::numeric,
        sqrt(ln(80::numeric) / (2 * v_conf_effective_n))
        + sqrt(ln(80::numeric) / (2 * v_outcome_effective_n)));
    end if;
  end if;

  return jsonb_build_object(
    'evidence_count', v_count,
    'evidence_quality', case when v_count > 0 then round(v_quality, 6) else null end,
    'uncertainty', case when v_radius is not null and v_count > 0 then round(v_radius, 6) else null end,
    'lower', case when v_radius is not null and v_count > 0 and p_estimate is not null then round(greatest(0::numeric, p_estimate - v_radius), 6) else null end,
    'upper', case when v_radius is not null and v_count > 0 and p_estimate is not null then round(least(1::numeric, p_estimate + v_radius), 6) else null end
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
    if coalesce(v_dimension_state->>'estimate','') ~ '^[0-9]+(\\.[0-9]+)?$'
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

-- Enrich existing authoritative rows without changing estimates or state versions.
update pie.pie_candidate_state set state = state;

comment on function pie._authoritative_dimension_evidence(uuid,text,numeric) is
  'Computes conservative dimension-specific evidence metadata from authoritative observations only; never reads shadow inference.';
comment on trigger pie_candidate_state_dimension_evidence on pie.pie_candidate_state is
  'Persists dimension evidence metadata into authoritative candidate state on each rebuild.';

notify pgrst, 'reload schema';
commit;
