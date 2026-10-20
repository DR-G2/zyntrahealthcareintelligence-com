-- 0103: Add authoritative mode-scoped latest-valid-observation timestamps.
-- This metadata-only trigger does not alter estimates, counts, inference formulas,
-- canonical top-level state, mode provenance, or shadow inference.
begin;

do $$
begin
  if to_regclass('pie.pie_candidate_state') is null
     or to_regclass('pie.pie_observation') is null
     or to_regprocedure('pie._attach_authoritative_mode_evidence()') is null then
    raise exception '0103 preflight: authoritative PIE evidence objects are missing';
  end if;
end $$;

create or replace function pie._attach_mode_evidence_timestamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
  v_dimension text;
  v_latest timestamptz;
  v_mode_state jsonb;
  v_dimension_state jsonb;
  v_mode_evidence jsonb := '{}'::jsonb;
begin
  foreach v_mode in array array['normal_mcq','amc_exam','nudge'] loop
    v_mode_state := coalesce(new.state->'mode_evidence'->v_mode, '{}'::jsonb);

    foreach v_dimension in array array[
      'capability','decision','timing','calibration','sustained_performance','learning'
    ] loop
      select max(o.observed_at)
        into v_latest
      from pie.pie_observation o
      where o.user_id = new.user_id
        and o.provenance->>'practice_mode' = v_mode
        and case
          when v_dimension in ('capability','sustained_performance','learning')
            then o.payload->>'outcome' in ('CORRECT','INCORRECT')
          when v_dimension = 'decision'
            then case
              when coalesce(o.payload->>'answer_changes','') ~ '^[0-9]+([.][0-9]+)?$'
                then (o.payload->>'answer_changes')::numeric >= 0
              else false
            end
          when v_dimension = 'timing'
            then case
              when coalesce(o.payload->>'time_total_ms','') ~ '^[0-9]+([.][0-9]+)?$'
                then (o.payload->>'time_total_ms')::numeric > 0
              else false
            end
          when v_dimension = 'calibration'
            then o.payload->>'outcome' in ('CORRECT','INCORRECT')
              and case
                when coalesce(o.payload->>'confidence_level','') ~ '^[1-5]$' then true
                when coalesce(o.payload->>'confidence_normalized','') ~ '^[0-9]+([.][0-9]+)?$'
                  then (o.payload->>'confidence_normalized')::numeric between 0 and 1
                else false
              end
          else false
        end;

      v_dimension_state := coalesce(v_mode_state->v_dimension, '{}'::jsonb)
        || jsonb_build_object('latest_observation_at', v_latest);
      v_mode_state := jsonb_set(v_mode_state, array[v_dimension], v_dimension_state, true);
    end loop;

    v_mode_evidence := jsonb_set(v_mode_evidence, array[v_mode], v_mode_state, true);
  end loop;

  new.state := jsonb_set(coalesce(new.state, '{}'::jsonb), '{mode_evidence}', v_mode_evidence, true);
  return new;
end;
$$;

revoke all on function pie._attach_mode_evidence_timestamps() from public, anon, authenticated, service_role;

-- PostgreSQL runs same-timing triggers alphabetically: the existing
-- pie_candidate_state_mode_evidence trigger builds mode_evidence first.
drop trigger if exists pie_candidate_state_mode_timestamps on pie.pie_candidate_state;
create trigger pie_candidate_state_mode_timestamps
before insert or update of state, user_id on pie.pie_candidate_state
for each row execute function pie._attach_mode_evidence_timestamps();

-- Backfill derived timestamps only. Existing mode-evidence trigger recomputes
-- the evidence object first; this trigger appends timestamps without changing estimates.
update pie.pie_candidate_state set state = state;

comment on function pie._attach_mode_evidence_timestamps() is
  'Attaches latest valid signal timestamp for each authoritative PIE dimension and explicit practice mode. No shadow reads and no estimator changes.';

notify pgrst, 'reload schema';
commit;
