-- 0101: Persist per-mode, per-dimension authoritative evidence without changing the canonical PIE estimator.
-- Only explicitly tagged observations contribute. Legacy/ambiguous observations stay unclassified.
-- Calibration is exposed only with >=15 valid scored answers at each confidence level 1..5.
begin;

do $$
begin
  if to_regclass('pie.pie_candidate_state') is null or to_regclass('pie.pie_observation') is null then
    raise exception '0101 preflight: authoritative PIE tables missing';
  end if;
  if not exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='pie' and c.relname='pie_candidate_state' and t.tgname='pie_candidate_state_dimension_evidence' and not t.tgisinternal) then
    raise exception '0101 preflight: 0094 authoritative evidence trigger missing';
  end if;
end $$;

create or replace function pie._authoritative_mode_evidence(p_user_id uuid, p_mode text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_outcome_count integer := 0;
  v_decision_count integer := 0;
  v_timing_count integer := 0;
  v_confidence_count integer := 0;
  v_calibration_count integer := 0;
  v_conf_1 integer := 0;
  v_conf_2 integer := 0;
  v_conf_3 integer := 0;
  v_conf_4 integer := 0;
  v_conf_5 integer := 0;
  v_confidence_level_counts jsonb;
  v_outcome_mean numeric;
  v_decision_mean numeric;
  v_timing_mean numeric;
  v_confidence_mean numeric;
  v_outcome_quality numeric;
  v_decision_quality numeric;
  v_timing_quality numeric;
  v_calibration_quality numeric;
  v_calibration_ready boolean := false;
  v_dimension text;
  v_count integer;
  v_mean numeric;
  v_quality numeric;
  v_estimate numeric;
  v_radius numeric;
  v_aligned boolean;
  v_metadata jsonb;
  v_result jsonb := '{}'::jsonb;
begin
  if p_user_id is null or p_mode not in ('normal_mcq','amc_exam','nudge') then
    raise exception 'Invalid mode-scoped PIE evidence request';
  end if;

  -- This projection applies the existing bounded-signal formulas to valid signals
  -- in one explicit mode. Missing timing/change/confidence/outcome signals are excluded,
  -- never imputed as zero. It reads no shadow tables and does not alter canonical state.
  with signals as (
    select
      case o.payload->>'outcome'
        when 'CORRECT' then 1::numeric
        when 'INCORRECT' then 0::numeric
        else null::numeric
      end as outcome_signal,
      case
        when coalesce(o.payload->>'confidence_level','') ~ '^[1-5]$'
          then ((o.payload->>'confidence_level')::integer - 1)::numeric / 4
        when coalesce(o.payload->>'confidence_normalized','') ~ '^[0-9]+([.][0-9]+)?$'
          and (o.payload->>'confidence_normalized')::numeric between 0 and 1
          then (o.payload->>'confidence_normalized')::numeric
        else null::numeric
      end as confidence_signal,
      case
        when coalesce(o.payload->>'confidence_level','') ~ '^[1-5]$'
          then (o.payload->>'confidence_level')::integer
        else null::integer
      end as confidence_level,
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
        else null::numeric
      end as decision_signal,
      case
        when o.payload->>'observation_quality' = 'UNUSABLE' then 0::numeric
        when o.payload->>'observation_quality' = 'CONTRADICTORY' then 0.15::numeric
        when o.payload->>'observation_quality' = 'SUSPICIOUS' then 0.5::numeric
        when o.payload->>'interaction_state' = 'INTERRUPTED' then 0.25::numeric
        else 1::numeric
      end as quality
    from pie.pie_observation o
    where o.user_id = p_user_id
      and (o.provenance->>'practice_mode' = p_mode or o.payload->>'practice_mode' = p_mode)
  )
  select
    count(*) filter (where outcome_signal is not null),
    avg(outcome_signal),
    avg(quality) filter (where outcome_signal is not null),
    count(*) filter (where decision_signal is not null),
    avg(decision_signal),
    avg(quality) filter (where decision_signal is not null),
    count(*) filter (where timing_signal is not null),
    avg(timing_signal),
    avg(quality) filter (where timing_signal is not null),
    count(*) filter (where confidence_signal is not null),
    avg(confidence_signal),
    count(*) filter (where confidence_signal is not null and outcome_signal is not null),
    avg(quality) filter (where confidence_signal is not null and outcome_signal is not null),
    count(*) filter (where confidence_level = 1 and confidence_signal is not null and outcome_signal is not null),
    count(*) filter (where confidence_level = 2 and confidence_signal is not null and outcome_signal is not null),
    count(*) filter (where confidence_level = 3 and confidence_signal is not null and outcome_signal is not null),
    count(*) filter (where confidence_level = 4 and confidence_signal is not null and outcome_signal is not null),
    count(*) filter (where confidence_level = 5 and confidence_signal is not null and outcome_signal is not null)
  into
    v_outcome_count, v_outcome_mean, v_outcome_quality,
    v_decision_count, v_decision_mean, v_decision_quality,
    v_timing_count, v_timing_mean, v_timing_quality,
    v_confidence_count, v_confidence_mean,
    v_calibration_count, v_calibration_quality,
    v_conf_1, v_conf_2, v_conf_3, v_conf_4, v_conf_5
  from signals;

  v_confidence_level_counts := jsonb_build_object(
    '1', v_conf_1, '2', v_conf_2, '3', v_conf_3, '4', v_conf_4, '5', v_conf_5
  );
  v_calibration_ready := v_conf_1 >= 15 and v_conf_2 >= 15 and v_conf_3 >= 15
    and v_conf_4 >= 15 and v_conf_5 >= 15 and v_calibration_count >= 50;

  foreach v_dimension in array array[
    'capability','decision','timing','calibration','sustained_performance','learning'
  ] loop
    v_count := 0; v_mean := null; v_quality := null; v_estimate := null; v_radius := null; v_aligned := false;
    if v_dimension in ('capability','sustained_performance','learning') then
      v_count := v_outcome_count; v_mean := v_outcome_mean; v_quality := v_outcome_quality;
    elsif v_dimension = 'decision' then
      v_count := v_decision_count; v_mean := v_decision_mean; v_quality := v_decision_quality;
    elsif v_dimension = 'timing' then
      v_count := v_timing_count; v_mean := v_timing_mean; v_quality := v_timing_quality;
    else
      v_count := v_calibration_count; v_quality := v_calibration_quality;
      if v_calibration_ready then
        v_mean := 1 - abs(coalesce(v_confidence_mean, 0.5::numeric) - coalesce(v_outcome_mean, 0::numeric));
      end if;
    end if;

    if v_dimension <> 'calibration' and v_count > 0 and v_mean is not null then
      v_estimate := round(v_mean, 4);
    elsif v_dimension = 'calibration' and v_calibration_ready and v_mean is not null then
      v_estimate := round(v_mean, 4);
    end if;
    v_aligned := v_estimate is not null;

    if v_aligned and v_count > 0 then
      if v_dimension = 'calibration' then
        v_radius := least(1::numeric,
          sqrt(ln(80::numeric) / (2 * v_confidence_count))
          + sqrt(ln(80::numeric) / (2 * v_outcome_count)));
      else
        v_radius := least(1::numeric, sqrt(ln(40::numeric) / (2 * v_count)));
      end if;
    end if;

    v_metadata := jsonb_build_object(
      'estimate', v_estimate,
      'evidence_count', v_count,
      'evidence_quality', case when v_count > 0 then round(v_quality, 6) else null end,
      'estimate_aligned', v_aligned,
      'uncertainty', case when v_radius is not null then round(v_radius, 6) else null end,
      'lower', case when v_radius is not null and v_estimate is not null then round(greatest(0::numeric, v_estimate - v_radius), 6) else null end,
      'upper', case when v_radius is not null and v_estimate is not null then round(least(1::numeric, v_estimate + v_radius), 6) else null end
    );
    if v_dimension = 'calibration' then
      v_metadata := v_metadata || jsonb_build_object(
        'calibration_ready', v_calibration_ready,
        'confidence_level_counts', v_confidence_level_counts
      );
    end if;
    v_result := jsonb_set(v_result, array[v_dimension], v_metadata, true);
  end loop;

  return v_result;
end;
$$;

revoke all on function pie._authoritative_mode_evidence(uuid,text) from public, anon, authenticated, service_role;

create or replace function pie._attach_authoritative_mode_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
  v_mode_evidence jsonb := '{}'::jsonb;
begin
  foreach v_mode in array array['normal_mcq','amc_exam','nudge'] loop
    v_mode_evidence := jsonb_set(v_mode_evidence, array[v_mode],
      pie._authoritative_mode_evidence(new.user_id, v_mode), true);
  end loop;
  new.state := jsonb_set(coalesce(new.state, '{}'::jsonb), '{mode_evidence}', v_mode_evidence, true);
  return new;
end;
$$;

revoke all on function pie._attach_authoritative_mode_evidence() from public, anon, authenticated, service_role;

drop trigger if exists pie_candidate_state_mode_evidence on pie.pie_candidate_state;
create trigger pie_candidate_state_mode_evidence
before insert or update of state, user_id on pie.pie_candidate_state
for each row execute function pie._attach_authoritative_mode_evidence();

-- Backfill only derived metadata. Canonical dimension estimates and inference formulas are untouched.
update pie.pie_candidate_state set state = state;

comment on function pie._authoritative_mode_evidence(uuid,text) is
  'Computes mode-scoped dimension estimates and evidence from explicit authoritative observation provenance; calibration requires 15 scored observations at every confidence level.';
comment on trigger pie_candidate_state_mode_evidence on pie.pie_candidate_state is
  'Attaches explicit-mode evidence metadata to candidate state without changing canonical estimates.';

notify pgrst, 'reload schema';
commit;
