-- PIE formula regression contract.
-- Run with psql against an isolated PostgreSQL instance:
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/verification_v2/pie_formula_regression_contract.sql
-- This file deliberately uses deterministic fixtures and no production tables.
-- It specifies required semantics; it does NOT certify that production RPCs use them.

begin;

do $test$
declare
  v_rush numeric;
  v_calibration numeric;
  v_fatigue numeric;
  v_first_instinct numeric;
  v_changed_count integer;
  v_eligible_changed_count integer;
begin
  -- Missing timing must not be treated as a zero-second rush.
  with attempts(seconds) as (values (null::numeric), (20::numeric), (80::numeric))
  select avg(case when seconds <= 45 then 1.0 else 0.0 end)
    filter (where seconds is not null)
    into v_rush
  from attempts;
  if v_rush <> 0.5 then
    raise exception 'PIE-REG-01 failed: rush should use only timed attempts; got %', v_rush;
  end if;

  -- No confidence observations means no calibration estimate, not a neutral 0.5.
  with attempts(confidence, correct) as (values (null::integer, true), (null::integer, false))
  select avg(1 - abs((confidence - 1) / 4.0 - case when correct then 1 else 0 end))
    into v_calibration
  from attempts
  where confidence between 1 and 5;
  if v_calibration is not null then
    raise exception 'PIE-REG-02 failed: absent confidence must yield NULL; got %', v_calibration;
  end if;

  -- A response-time increase is not, by itself, a validated fatigue measurement.
  -- The producer must name the signal descriptively, not infer a latent cause.
  v_fatigue := null;
  if v_fatigue is not null then
    raise exception 'PIE-REG-03 failed: unvalidated fatigue label must not be emitted';
  end if;

  -- Only changed attempts with a usable first choice and answer key belong in
  -- the Trust Your Gut denominator.
  with attempts(changed, sequence_first, answer_key) as (
    values
      (true, 'A'::text, 'A'::text),
      (true, null::text, 'B'::text),
      (true, 'C'::text, null::text),
      (false, 'D'::text, 'D'::text)
  )
  select count(*) filter (where changed),
         count(*) filter (where changed and sequence_first is not null and answer_key is not null)
    into v_changed_count, v_eligible_changed_count
  from attempts;

  if v_changed_count <> 3 or v_eligible_changed_count <> 1 then
    raise exception 'PIE-REG-04 fixture invalid: changed %, eligible %', v_changed_count, v_eligible_changed_count;
  end if;

  select 100.0 * count(*) filter (where sequence_first = answer_key)
         / nullif(count(*) filter (where changed and sequence_first is not null and answer_key is not null), 0)
    into v_first_instinct
  from (values
    (true, 'A'::text, 'A'::text),
    (true, null::text, 'B'::text),
    (true, 'C'::text, null::text),
    (false, 'D'::text, 'D'::text)
  ) as attempts(changed, sequence_first, answer_key)
  where changed;

  if v_first_instinct <> 100 then
    raise exception 'PIE-REG-04 failed: expected 100%% on eligible paired evidence; got %', v_first_instinct;
  end if;
end
$test$;

rollback;
