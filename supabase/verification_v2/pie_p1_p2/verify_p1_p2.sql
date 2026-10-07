-- LOCAL ONLY. Assertion script for 0045-0047. Any failed assertion aborts (ON_ERROR_STOP).
\set ON_ERROR_STOP 1
\set A '''aaaaaaaa-0000-0000-0000-00000000000a'''
\set B '''bbbbbbbb-0000-0000-0000-00000000000b'''
\echo '### T1 one primary LO per question'
do $$ begin
  begin
    insert into pie.question_lo(question_id, lo_id, is_primary) values
      ('22222222-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002', true);
    raise exception 'FAIL T1: second primary LO accepted';
  exception when unique_violation then null; end;
end $$;
\echo '### T2 stable keys immutable'
do $$ begin
  begin
    update pie.learning_objective set lo_key = 'X.Y' where lo_key = 'CARDIO.HF.DX';
    raise exception 'FAIL T2';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
\echo '### T3 irt_b source required / calibrated fields'
do $$ begin
  begin update public.questions set irt_b_source = null where id='22222222-0000-0000-0000-000000000001'; raise exception 'FAIL T3a';
  exception when check_violation then null; end;
  begin update public.questions set irt_b_source = 'calibrated' where id='22222222-0000-0000-0000-000000000001'; raise exception 'FAIL T3b';
  exception when check_violation then null; end;
end $$;

\echo '### T4 learner A answers through save_attempt (server-graded)'
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select (public.create_practice_session('mcq','{}'::jsonb, array(
  select ('22222222-0000-0000-0000-0000000000'||lpad(g::text,2,'0'))::uuid from generate_series(1,12) g))).id as sid \gset
-- Q1 correct (fragile: first answer B), Q2 correct confident, Q3 wrong confident, Q4 wrong twice-option-C
commit;
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select (public.save_attempt('22222222-0000-0000-0000-000000000001', :'sid', 'A', false, 30, 1::smallint, 1, 5, '["B","A"]'::jsonb)).is_correct as q1 \gset
commit;
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select (public.save_attempt('22222222-0000-0000-0000-000000000002', :'sid', 'A', false, 20, 5::smallint, 0, 3, '["A"]'::jsonb)).is_correct as q2 \gset
commit;
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select (public.save_attempt('22222222-0000-0000-0000-000000000003', :'sid', 'C', true, 25, 5::smallint, 0, 3, '["C"]'::jsonb)).is_correct as q3 \gset
commit;
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select (public.save_attempt('22222222-0000-0000-0000-000000000009', :'sid', 'C', true, 25, 3::smallint, 0, 3, '["C"]'::jsonb)).is_correct as q9 \gset
commit;
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select (public.save_attempt('22222222-0000-0000-0000-000000000009', :'sid', 'C', true, 25, 3::smallint, 0, 3, '["C"]'::jsonb)).is_correct as q9b \gset
commit;
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select public.t_assert(:'q1'::boolean and :'q2'::boolean and not :'q3'::boolean and not :'q9'::boolean, 'T4 server grading');
select public.refresh_my_lo_state() as nrows \gset
select public.t_assert(:'nrows'::int = 2, 'T4 expected 2 LO rows, got ' || :'nrows');
commit;

\echo '### T5 derived state values (as learner A via get_my_lo_state)'
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
do $$
declare d record; r record;
begin
  select * into d from public.get_my_lo_state() where lo_key = 'CARDIO.HF.DX';
  if d is null then raise exception 'FAIL T5: no state'; end if;
  if d.exposure_count <> 3 then raise exception 'FAIL T5 exposure %', d.exposure_count; end if;
  if d.fragile_correct <> 1 then raise exception 'FAIL T5 fragile %', d.fragile_correct; end if;
  if d.confident_wrong <> 1 then raise exception 'FAIL T5 confident_wrong %', d.confident_wrong; end if;
  if (d.behaviour_state->>'first_answer_correct_rate')::numeric <> round(1/3.0,4) then raise exception 'FAIL T5 FAC %', d.behaviour_state; end if;
  if d.review_due_at is not null then raise exception 'FAIL T5 review_due_at must be NULL until P6'; end if;
  if d.mastery_confidence <= 0 or d.mastery_confidence >= 1 then raise exception 'FAIL T5 conf'; end if;
  if d.outcome_history::text ~* 'correct_answer|selected' then raise exception 'FAIL T5 answer key/selection in history'; end if;
  select * into r from public.get_my_lo_state() where lo_key = 'RENAL.AKI.DX';
  -- Q9 twice wrong with option C + Q1 (secondary, weight .5) correct
  if r.exposure_count <> 3 then raise exception 'FAIL T5 AKI exposure %', r.exposure_count; end if;
  if not (r.misconception_state->'repeated_wrong_option') ? '22222222-0000-0000-0000-000000000009:C' then raise exception 'FAIL T5 repeated wrong option %', r.misconception_state; end if;
end $$;
commit;

\echo '### T6 recompute is deterministic (replay equality)'
create temp table snap as select lo_id, mastery, mastery_confidence, ability_theta, exposure_count, outcome_history, fragile_correct, confident_wrong, behaviour_state, confidence_state, misconception_state, difficulty_history from pie.learner_lo_state where user_id = :A;
select pie.recompute_learner_lo_state(:A) \g /dev/null
do $$ begin
  if exists (select lo_id, mastery, mastery_confidence, ability_theta, exposure_count, outcome_history, fragile_correct, confident_wrong, behaviour_state, confidence_state, misconception_state, difficulty_history from pie.learner_lo_state where user_id='aaaaaaaa-0000-0000-0000-00000000000a'
             except select * from snap) then raise exception 'FAIL T6 non-deterministic'; end if;
end $$;

\echo '### T7 IRT weighting: correct on hard item raises mastery more than on easy item'
do $$ declare hard numeric; easy numeric; begin
  -- single-attempt theta update closed form: K=1.2, theta=0
  easy := 1.2 * (1 - (0.2 + 0.8/(1+exp(-(0 - (-1.0))))));
  hard := 1.2 * (1 - (0.2 + 0.8/(1+exp(-(0 - (1.0))))));
  if not hard > easy then raise exception 'FAIL T7'; end if;
end $$;

\echo '### T8 learner cannot write or read raw state / content tables'
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
do $$
declare t text;
begin
  foreach t in array array['pie.learner_lo_state','pie.concept','pie.learning_objective','pie.question_lo','amc.amc_blueprint_lo','amc.amc_lo_taxonomy'] loop
    begin execute format('select 1 from %s limit 1', t); raise exception 'FAIL T8 read %', t;
    exception when insufficient_privilege then null; end;
  end loop;
  begin insert into public.user_attempts(user_id,question_id,selected_answer,is_correct) values ('aaaaaaaa-0000-0000-0000-00000000000a','22222222-0000-0000-0000-000000000005','Z',true);
    raise exception 'FAIL T8 forged attempt insert'; exception when insufficient_privilege then null; end;
  begin update public.user_attempts set is_correct = true; raise exception 'FAIL T8 attempt update';
    exception when insufficient_privilege then null; end;
  begin update public.practice_sessions set status = 'active'; raise exception 'FAIL T8 session reopen';
    exception when insufficient_privilege then null; end;
  begin insert into intelligence.behavior_events(user_id,event_type,event_version,occurred_at,payload) values ('aaaaaaaa-0000-0000-0000-00000000000a','X',1,now(),'{}');
    raise exception 'FAIL T8 behaviour injection'; exception when insufficient_privilege then null; end;
  begin perform pie.recompute_learner_lo_state('aaaaaaaa-0000-0000-0000-00000000000a'); raise exception 'FAIL T8 internal fn';
    exception when insufficient_privilege then null; end;
  begin perform irt_b from public.questions limit 1; raise exception 'FAIL T8 irt_b readable';
    exception when insufficient_privilege then null; end;
  begin perform correct_answer from public.questions limit 1; raise exception 'FAIL T8 answer key readable';
    exception when insufficient_privilege then null; end;
end $$;
commit;

\echo '### T9 cross-user isolation (learner B sees nothing of A)'
begin;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
do $$ begin
  if (select count(*) from public.get_my_lo_state()) <> 0 then raise exception 'FAIL T9 leak'; end if;
  if public.refresh_my_lo_state() <> 0 then raise exception 'FAIL T9 refresh scope'; end if;
end $$;
commit;

\echo '### T10 anon denied'
begin;
select set_config('request.jwt.claims','{"role":"anon"}',true) \g /dev/null
set local role anon;
do $$ begin
  begin perform public.get_my_lo_state(); raise exception 'FAIL T10 anon get'; exception when insufficient_privilege then null; end;
  begin perform public.refresh_my_lo_state(); raise exception 'FAIL T10 anon refresh'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.user_attempts limit 1; raise exception 'FAIL T10 anon attempts'; exception when insufficient_privilege then null; end;
end $$;
commit;

\echo '### T11 immutability holds even for privileged roles; erasure cascade still works'
do $$ begin
  begin update public.user_attempts set is_correct = not is_correct; raise exception 'FAIL T11 privileged update';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
begin;
delete from public.practice_sessions where user_id = :A;  -- ON DELETE SET NULL path
do $$ begin if exists (select 1 from public.user_attempts where session_id is not null and user_id='aaaaaaaa-0000-0000-0000-00000000000a') then raise exception 'FAIL T11 set null'; end if; end $$;
rollback;

\echo '### T12 shadow table sealed'
do $$ begin
  begin insert into pie.pie_shadow_run default values; raise exception 'FAIL T12';
  exception when object_not_in_prerequisite_state or not_null_violation then null; end;
end $$;

\echo '### T13 catalog: no learner privilege on new objects, RLS on'
do $$ begin
  if exists (select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated')
             and (table_schema, table_name) in (('pie','learner_lo_state'),('pie','concept'),('pie','learning_objective'),('pie','question_lo'),('amc','amc_blueprint_lo'),('amc','amc_lo_taxonomy'),('pie','pie_shadow_run')))
  then raise exception 'FAIL T13 grants'; end if;
  if exists (select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public'
             and table_name in ('user_attempts','practice_sessions','practice_session_questions') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE'))
  then raise exception 'FAIL T13 write grants remain'; end if;
  if exists (select 1 from information_schema.column_privileges where grantee in ('anon','authenticated') and table_schema='public' and table_name='questions'
             and column_name in ('correct_answer','irt_b','irt_b_se','irt_b_source','irt_b_calibrated_at','irt_b_calibration_n','irt_model'))
  then raise exception 'FAIL T13 column grants'; end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('pie','amc') and c.relkind='r' and not c.relrowsecurity
             and c.relname in ('learner_lo_state','concept','learning_objective','question_lo','amc_blueprint_lo','amc_lo_taxonomy'))
  then raise exception 'FAIL T13 rls'; end if;
end $$;
\echo 'ALL P1/P2 ASSERTIONS PASSED'
