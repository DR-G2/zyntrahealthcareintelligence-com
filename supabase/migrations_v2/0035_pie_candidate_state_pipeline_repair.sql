-- 0035: Repair the production PIE candidate-state pipeline.
--
-- Root cause (reproduced against migrations 0001-0034 on a local Postgres 17 replica):
--   1. pie.rebuild_candidate_state inserted pie_model_version.status = 'SHADOW', but the
--      table CHECK only allows lowercase ('draft','shadow','active','retired'). CHECK
--      constraints are evaluated before ON CONFLICT, so EVERY call raised 23514 and
--      rolled back. No candidate state could ever be written.
--   2. Even past (1), pie_inference_run.status = 'COMPLETED' violated its lowercase CHECK.
--   3. Even past (2), the rebuild INSERTed a new pie_candidate_state row per call while the
--      table has UNIQUE(user_id), so every rebuild after the first raised 23505.
--   4. public.my_pie_state is a security_invoker view over pie.pie_candidate_state, but
--      authenticated has no SELECT on that internal table (by design), so every learner
--      read raised 42501 "permission denied for table pie_candidate_state".
--   5. public.rebuild_candidate_state(uuid) existed only in the live database (drift).
--
-- This migration keeps PIE as the production engine, keeps RLS enabled, does not grant
-- learners any privilege on internal pie.* tables, and does not change the PIE inference
-- maths. It is idempotent and safe to run more than once.

-- Preflight: the upsert below relies on the repo-defined UNIQUE(user_id) on pie_candidate_state.
do $$
begin
  if not exists (
    select 1
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = 'pie.pie_candidate_state'::regclass
      and i.indisunique
      and i.indnatts = 1
      and a.attname = 'user_id'
  ) then
    raise exception 'pie.pie_candidate_state is missing UNIQUE(user_id); aborting 0035 so no state is written ambiguously. Inspect live drift first.';
  end if;
end $$;

-- 1. Register the candidate-state model version with a status the CHECK constraint accepts.
do $$
begin
  if not exists (select 1 from pie.pie_model_version where model_key = 'candidate-state' and version = 'v2.0') then
    begin
      insert into pie.pie_model_version(model_key, version, status, config)
      values ('candidate-state', 'v2.0', 'active',
              jsonb_build_object('method', 'deterministic_bounded_state', 'window', 100));
    exception when check_violation then
      -- Live drift tolerance: fall back to the column default if 'active' is not accepted.
      insert into pie.pie_model_version(model_key, version, config)
      values ('candidate-state', 'v2.0',
              jsonb_build_object('method', 'deterministic_bounded_state', 'window', 100));
    end;
  end if;
end $$;

-- 2. Internal rebuild: same inference maths as 0030, now persistable and idempotent.
create or replace function pie.rebuild_candidate_state(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_model uuid;
  v_run uuid;
  v_state_id uuid;
  v_n integer;
  v_accuracy numeric;
  v_confidence numeric;
  v_timing numeric;
  v_changes numeric;
  v_state jsonb;
begin
  if p_user_id is null then
    raise exception 'User id required' using errcode = '22004';
  end if;

  -- service_role may rebuild any user; an authenticated JWT may only rebuild itself.
  -- A call with no JWT context is only possible from privileged DB roles, because
  -- EXECUTE is granted to service_role only (the public wrapper runs as owner).
  if v_role = 'service_role' then
    null;
  elsif v_uid is not null and v_uid = p_user_id then
    null;
  elsif v_uid is null and v_role = '' then
    null;
  else
    raise exception 'User scope violation' using errcode = '42501';
  end if;

  select id into v_model
  from pie.pie_model_version
  where model_key = 'candidate-state' and version = 'v2.0'
  limit 1;
  if v_model is null then
    raise exception 'PIE model version candidate-state/v2.0 is not registered' using errcode = 'P0002';
  end if;

  with recent as (
    select payload
    from pie.pie_observation
    where user_id = p_user_id
    order by observed_at desc
    limit 100
  )
  select count(*)::int,
    coalesce(avg(case when payload->>'outcome' = 'CORRECT' then 1 when payload->>'outcome' = 'INCORRECT' then 0 end), 0),
    coalesce(avg(nullif((payload->>'confidence_normalized')::numeric, null)), 0.5),
    coalesce(avg(case when (payload->>'time_total_ms')::numeric > 0 then 1 / (1 + ln(1 + (payload->>'time_total_ms')::numeric / 1000) / 10) end), 0.5),
    coalesce(avg(least(1, greatest(0, 1 - (coalesce((payload->>'answer_changes')::numeric, 0) / 3)))), 0.5)
  into v_n, v_accuracy, v_confidence, v_timing, v_changes
  from recent;

  v_state := jsonb_build_object(
    'capability', jsonb_build_object('estimate', round(v_accuracy, 4)),
    'decision', jsonb_build_object('estimate', round(v_changes, 4)),
    'timing', jsonb_build_object('estimate', round(v_timing, 4)),
    'calibration', jsonb_build_object('estimate', round(1 - abs(v_confidence - v_accuracy), 4)),
    'sustained_performance', jsonb_build_object('estimate', round(v_accuracy, 4)),
    'learning', jsonb_build_object('estimate', round(v_accuracy, 4)),
    'evidence_count', v_n,
    'evidence_level', case
      when v_n < 6 then 'INSUFFICIENT'
      when v_n < 20 then 'PRELIMINARY'
      when v_n < 40 then 'DEVELOPING'
      else 'ESTABLISHED_INDIVIDUAL_EVIDENCE'
    end
  );

  -- Audit row first so the candidate state can carry its provenance.
  begin
    insert into pie.pie_inference_run(user_id, model_version_id, trigger_type, input_window, output_summary, status, started_at, completed_at)
    values (p_user_id, v_model, 'REBUILD', jsonb_build_object('observation_count', v_n, 'window', 100), v_state, 'completed', now(), now())
    returning id into v_run;
  exception when check_violation then
    -- Live drift tolerance for an uppercase status CHECK.
    insert into pie.pie_inference_run(user_id, model_version_id, trigger_type, input_window, output_summary, status, started_at, completed_at)
    values (p_user_id, v_model, 'REBUILD', jsonb_build_object('observation_count', v_n, 'window', 100), v_state, 'COMPLETED', now(), now())
    returning id into v_run;
  end;

  -- One current state row per learner (UNIQUE(user_id)); state_version is the monotonic sequence.
  insert into pie.pie_candidate_state as cs
    (user_id, state_version, state, confidence, model_version_id, source_inference_id, calculated_at, updated_at)
  values
    (p_user_id, 1, v_state, least(1, greatest(0, v_n / 100.0)), v_model, v_run, now(), now())
  on conflict (user_id) do update
    set state_version = cs.state_version + 1,
        state = excluded.state,
        confidence = excluded.confidence,
        model_version_id = excluded.model_version_id,
        source_inference_id = excluded.source_inference_id,
        calculated_at = excluded.calculated_at,
        updated_at = excluded.updated_at
  returning cs.id into v_state_id;

  return v_state_id;
end $$;

revoke all on function pie.rebuild_candidate_state(uuid) from public, anon, authenticated;
grant execute on function pie.rebuild_candidate_state(uuid) to service_role;

-- 3. Authenticated browser entry point (previously live-only drift). Browsers call
--    v2.rpc('rebuild_candidate_state') here instead of v2.schema('pie').rpc(...).
drop function if exists public.rebuild_candidate_state(uuid);
create function public.rebuild_candidate_state(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_user_id is null or auth.uid() <> p_user_id then
    raise exception 'User scope violation' using errcode = '42501';
  end if;
  return pie.rebuild_candidate_state(p_user_id);
end $$;

revoke all on function public.rebuild_candidate_state(uuid) from public, anon, authenticated;
grant execute on function public.rebuild_candidate_state(uuid) to authenticated, service_role;

-- 4. Learner-safe read path. No grant on pie.pie_candidate_state is given to learners;
--    a SECURITY DEFINER reader returns only the caller's own latest row.
create or replace function public.get_my_pie_state()
returns table (
  user_id uuid,
  state_version integer,
  state jsonb,
  confidence numeric,
  calculated_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id, s.state_version, s.state, s.confidence, s.calculated_at, s.updated_at
  from pie.pie_candidate_state s
  where auth.uid() is not null
    and s.user_id = auth.uid()
  order by s.state_version desc
  limit 1
$$;

revoke all on function public.get_my_pie_state() from public, anon, authenticated;
grant execute on function public.get_my_pie_state() to authenticated;

drop view if exists public.my_pie_state;
create view public.my_pie_state
with (security_invoker = true)
as
select user_id, state_version, state, confidence, calculated_at, updated_at
from public.get_my_pie_state();

revoke all on public.my_pie_state from public, anon, authenticated;
grant select on public.my_pie_state to authenticated;

-- 5. Make PostgREST pick up the new/changed functions immediately.
notify pgrst, 'reload schema';
