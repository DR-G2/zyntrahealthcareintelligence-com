-- 0044: Repair the production PIE candidate-state pipeline (written against LIVE V2).
--
-- Target: V2 project hkowvjazuwebmibssdut as it stood after the last live migration
-- 20261006111928_expose_pie_rpc_schema (see migrations_v2/live_applied/README.md).
-- Verified on a local Postgres 17 replica built by replaying all 57 live migrations in
-- live order; that replica's catalog fingerprint (functions, grants, views, tables, column
-- grants, policies, constraints, triggers, indexes) matches live exactly.
--
-- Root cause (reproduced on the replica, confirmed read-only on live):
--   1. pie.rebuild_candidate_state inserts pie_model_version.status = 'SHADOW', but the CHECK
--      only allows 'draft','shadow','active','retired'. CHECK runs before ON CONFLICT, so
--      every rebuild raises 23514 and rolls back: 0 candidate states can ever exist.
--   2. Past (1), pie_inference_run.status = 'COMPLETED' violates its lowercase CHECK.
--   3. Past (2), every rebuild INSERTs a new pie_candidate_state row although the table has
--      UNIQUE(user_id), so every rebuild after the first raises 23505.
--   4. public.my_pie_state is a security_invoker view over pie.pie_candidate_state;
--      authenticated (correctly) has no SELECT on that table, so every learner read raises
--      42501 "permission denied for table pie_candidate_state".
--   5. public.save_attempt writes the PIE observation inside
--      "exception when others then null", hiding any observation failure.
--   6. pie.rebuild_candidate_state and pie.record_observation are EXECUTE-able by
--      authenticated while the pie schema is exposed to PostgREST. record_observation lets a
--      learner self-report outcome=CORRECT evidence; nothing legitimate calls it.
--
-- Guarantees: PIE stays the production engine (model status 'active', not shadow); RLS stays
-- enabled; learners get NO privilege on any pie.* table; PIE maths unchanged; Practice
-- grading/persistence unchanged and never blocked by PIE. Idempotent. The preflight aborts
-- before any change if live does not match the shape this file was written for.

-- 0. Preflight -------------------------------------------------------------------------
do $$
declare
  v_src text;
begin
  -- Constraints this repair relies on.
  if coalesce((select pg_get_constraintdef(oid) from pg_constraint
               where conrelid = 'pie.pie_model_version'::regclass
                 and conname = 'pie_model_version_status_check'), '') not like '%''active''::text%' then
    raise exception '0044 preflight: pie_model_version_status_check does not allow lowercase ''active''. Live differs; aborting.';
  end if;
  if coalesce((select pg_get_constraintdef(oid) from pg_constraint
               where conrelid = 'pie.pie_inference_run'::regclass
                 and conname = 'pie_inference_run_status_check'), '') not like '%''completed''::text%' then
    raise exception '0044 preflight: pie_inference_run_status_check does not allow lowercase ''completed''. Live differs; aborting.';
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid = 'pie.pie_candidate_state'::regclass and contype = 'u'
                   and pg_get_constraintdef(oid) = 'UNIQUE (user_id)') then
    raise exception '0044 preflight: pie.pie_candidate_state has no UNIQUE (user_id). Live differs; aborting.';
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid = 'pie.pie_model_version'::regclass and contype = 'u'
                   and pg_get_constraintdef(oid) = 'UNIQUE (model_key, version)') then
    raise exception '0044 preflight: pie.pie_model_version has no UNIQUE (model_key, version). Live differs; aborting.';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'pie' and table_name = 'pie_candidate_state'
        and (column_name, data_type) in (('user_id','uuid'), ('state_version','integer'), ('state','jsonb'),
                                         ('confidence','numeric'), ('model_version_id','uuid'),
                                         ('source_inference_id','uuid'),
                                         ('calculated_at','timestamp with time zone'),
                                         ('updated_at','timestamp with time zone'))) <> 8 then
    raise exception '0044 preflight: pie.pie_candidate_state columns differ from live 2026-10-06. Aborting.';
  end if;
  if to_regclass('public.my_pie_state') is null then
    raise exception '0044 preflight: public.my_pie_state is missing. Live differs; aborting.';
  end if;

  -- Functions replaced below must be exactly the live 2026-10-06 bodies, or already 0044.
  select prosrc into v_src from pg_proc
  where oid = to_regprocedure('public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb)');
  if v_src is null or (md5(v_src) <> 'd90edb259ef23e19992a3e200a1ae7cc' and position('0044_pie_candidate_state_pipeline_repair' in v_src) = 0) then
    raise exception '0044 preflight: public.save_attempt differs from live 0040_harden_practice_attempt_boundary. Aborting.';
  end if;
  select prosrc into v_src from pg_proc where oid = to_regprocedure('pie.rebuild_candidate_state(uuid)');
  if v_src is null or (md5(v_src) <> 'ffda67ea63dbbf753b35291a09860a13' and position('0044_pie_candidate_state_pipeline_repair' in v_src) = 0) then
    raise exception '0044 preflight: pie.rebuild_candidate_state differs from live pie_candidate_state_self_refresh. Aborting.';
  end if;
  select prosrc into v_src from pg_proc where oid = to_regprocedure('public.rebuild_candidate_state(uuid)');
  if v_src is null or (md5(v_src) <> 'f5d15bc6476ccf66c81a34853eaa39ee' and position('0044_pie_candidate_state_pipeline_repair' in v_src) = 0) then
    raise exception '0044 preflight: public.rebuild_candidate_state differs from live public_pie_rebuild_boundary. Aborting.';
  end if;
end $$;

-- 1. Register the production candidate-state model with a status the CHECK accepts. ----
insert into pie.pie_model_version (model_key, version, status, config)
values ('candidate-state', 'v2.0', 'active',
        jsonb_build_object('method', 'deterministic_bounded_state', 'window', 100))
on conflict (model_key, version) do nothing;

-- 2. Internal rebuild: same inference maths as live, now persistable and one row per learner.
create or replace function pie.rebuild_candidate_state(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
-- 0044_pie_candidate_state_pipeline_repair
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

  -- service_role may rebuild anyone; a learner JWT only itself. A call with no JWT at all
  -- can only come from a privileged database role (EXECUTE is service_role-only; the public
  -- wrapper below runs as owner but still carries the caller's JWT).
  if v_role = 'service_role' then
    null;
  elsif v_uid is not null and v_uid = p_user_id then
    null;
  elsif v_uid is null and v_role = '' then
    null;
  else
    raise exception 'User scope violation' using errcode = '42501';
  end if;

  insert into pie.pie_model_version (model_key, version, status, config)
  values ('candidate-state', 'v2.0', 'active',
          jsonb_build_object('method', 'deterministic_bounded_state', 'window', 100))
  on conflict (model_key, version) do nothing;
  select id into v_model from pie.pie_model_version
  where model_key = 'candidate-state' and version = 'v2.0';

  with recent as (
    select payload from pie.pie_observation
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

  insert into pie.pie_inference_run (user_id, model_version_id, trigger_type, input_window, output_summary, status, started_at, completed_at)
  values (p_user_id, v_model, 'REBUILD', jsonb_build_object('observation_count', v_n, 'window', 100), v_state, 'completed', now(), now())
  returning id into v_run;

  -- One current row per learner (UNIQUE(user_id)); state_version increments on every rebuild.
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

-- 3. Browser entry point: v2.rpc('rebuild_candidate_state', { p_user_id }). ------------
create or replace function public.rebuild_candidate_state(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
-- 0044_pie_candidate_state_pipeline_repair
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

-- 4. Learner-safe read path. No learner grant on pie.pie_candidate_state: a SECURITY DEFINER
--    reader returns only the caller's own row, and my_pie_state keeps its exact columns.
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
  -- 0044_pie_candidate_state_pipeline_repair
  select s.user_id, s.state_version, s.state, s.confidence, s.calculated_at, s.updated_at
  from pie.pie_candidate_state s
  where auth.uid() is not null
    and s.user_id = auth.uid()
  order by s.state_version desc
  limit 1
$$;

revoke all on function public.get_my_pie_state() from public, anon, authenticated;
grant execute on function public.get_my_pie_state() to authenticated, service_role;

create or replace view public.my_pie_state
with (security_invoker = true)
as
select user_id, state_version, state, confidence, calculated_at, updated_at
from public.get_my_pie_state();

revoke all on public.my_pie_state from public, anon, authenticated;
grant select on public.my_pie_state to authenticated;

-- 5. Learners must not self-report PIE evidence; only save_attempt writes observations. -
revoke all on function pie.record_observation(text, jsonb, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function pie.record_observation(text, jsonb, uuid, uuid, uuid) to service_role;

-- 6. save_attempt: identical to live 0040 except downstream telemetry/PIE failures are now
--    logged with RAISE WARNING instead of silently swallowed. The attempt row is written
--    before either block and each block is its own sub-transaction, so a PIE failure can
--    never undo or block the authoritative attempt.
create or replace function public.save_attempt(
p_question_id uuid,
p_session_id uuid,
p_selected_answer text,
p_is_correct boolean,
p_time_taken_seconds integer default null,
p_confidence_level smallint default null,
p_answer_changes_count integer default 0,
p_time_to_first_click integer default null,
p_change_sequence jsonb default null,
p_pause_events jsonb default null,
p_time_of_day text default null,
p_question_position integer default null,
p_previous_question_correct boolean default null,
p_question_version integer default null,
p_app_version text default null,
p_provenance jsonb default '{}'::jsonb
)
returns public.user_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
-- 0044_pie_candidate_state_pipeline_repair
declare
 v_attempt public.user_attempts;
 v_user uuid := auth.uid();
 v_correct_answer text;
 v_is_correct boolean;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_confidence_level is not null and p_confidence_level not between 1 and 5 then raise exception 'confidence_level must be between 1 and 5'; end if;

 select q.correct_answer into v_correct_answer
 from public.questions q
 where q.id=p_question_id and q.status='active';

 if not found then raise exception 'question not found or inactive'; end if;

 if p_session_id is not null and not exists(
   select 1
   from public.practice_session_questions psq
   join public.practice_sessions ps on ps.id=psq.session_id
   where psq.session_id=p_session_id
     and psq.question_id=p_question_id
     and ps.user_id=v_user
     and ps.status='active'
 ) then
   raise exception 'question is not part of an active authenticated practice session';
 end if;

 v_is_correct := upper(trim(coalesce(p_selected_answer,'')))=upper(trim(coalesce(v_correct_answer,'')));

 insert into public.user_attempts(
   user_id,question_id,session_id,selected_answer,is_correct,time_taken_seconds,
   confidence_level,answer_changes_count,time_to_first_click,change_sequence,
   pause_events,time_of_day,question_position,previous_question_correct,
   question_version,app_version,provenance
 )
 values(
   v_user,p_question_id,p_session_id,p_selected_answer,v_is_correct,p_time_taken_seconds,
   p_confidence_level,p_answer_changes_count,p_time_to_first_click,p_change_sequence,
   p_pause_events,p_time_of_day,p_question_position,p_previous_question_correct,
   p_question_version,p_app_version,coalesce(p_provenance,'{}'::jsonb)
 )
 returning * into v_attempt;

 update public.practice_session_questions
 set answered_at=now()
 where session_id=p_session_id and question_id=p_question_id;

 update public.practice_sessions
 set last_activity_at=now(),updated_at=now()
 where id=p_session_id and user_id=v_user;

 begin
   insert into intelligence.behavior_events(
     user_id,session_id,question_id,event_type,event_version,occurred_at,
     sequence_no,question_position,payload
   )
   values(
     v_user,p_session_id,p_question_id,'MCQ_ATTEMPT',1,now(),
     p_question_position,p_question_position,
     jsonb_build_object(
       'is_correct',v_is_correct,
       'time_taken_seconds',p_time_taken_seconds,
       'confidence_level',p_confidence_level,
       'answer_changes_count',p_answer_changes_count
     )
   );
 exception when others then
   raise warning 'save_attempt: behavior_event not recorded for attempt % (SQLSTATE %): %', v_attempt.id, sqlstate, sqlerrm;
 end;

 begin
   insert into pie.pie_observation(
     user_id,question_id,attempt_id,observation_type,observed_at,payload,provenance
   )
   values(
     v_user,p_question_id,v_attempt.id,'MCQ_ATTEMPT',now(),
     jsonb_build_object(
       'outcome',case when v_is_correct then 'CORRECT' else 'INCORRECT' end,
       'confidence_normalized',case when p_confidence_level is null then null else (p_confidence_level-1)/4.0 end,
       'time_total_ms',case when p_time_taken_seconds is null then null else p_time_taken_seconds*1000 end,
       'answer_changes',coalesce(p_answer_changes_count,0),
       'first_answer_correct',null,
       'final_answer_correct',v_is_correct
     ),
     jsonb_build_object('source','public.save_attempt','question_version',p_question_version)
   );
 exception when others then
   raise warning 'save_attempt: PIE observation not recorded for attempt % (SQLSTATE %): %', v_attempt.id, sqlstate, sqlerrm;
 end;

 return v_attempt;
end
$function$;

revoke all on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) from public, anon;
grant execute on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) to authenticated, service_role;

-- 7. Make PostgREST pick up the changed functions/view immediately. ---------------------
notify pgrst, 'reload schema';
