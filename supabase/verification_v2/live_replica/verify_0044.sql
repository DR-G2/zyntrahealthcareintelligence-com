-- LOCAL ONLY. Two-user + anon verification of 0044 on a live-schema replica.
-- Run after replay + seed.sql + 0044. Never run against live (it writes test data).
\set ON_ERROR_STOP 0
\pset footer off
\set A 'aaaaaaaa-0000-0000-0000-00000000000a'
\set B 'bbbbbbbb-0000-0000-0000-00000000000b'

\echo '### 1. FLOW as user A (authenticated JWT, as PostgREST runs it)'
begin; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
\echo '-- my_pie_state before any rebuild (expect 0 rows, no error)'
select count(*) as rows_before from public.my_pie_state;
\echo '-- active session + save_attempt (server grades; client says is_correct=false, answer A is correct)'
select id as sid from public.create_practice_session('mcq','{}'::jsonb, array['22222222-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002']::uuid[]) \gset
select is_correct as server_graded_correct from public.save_attempt('22222222-0000-0000-0000-000000000001'::uuid, :'sid'::uuid, 'A', false, 12, 4::smallint, 0, 3, null, null, null, 0, null, 1, 'test', '{}'::jsonb);
\echo '-- public.rebuild_candidate_state(self)'
select public.rebuild_candidate_state(:'A') is not null as rebuilt_v1;
select user_id = :'A'::uuid as own_row, state_version, state->>'evidence_level' lvl, (state->>'evidence_count')::int n, confidence from public.my_pie_state;
\echo '-- 6 more answers in a new session, complete, rebuild'
select status from public.complete_practice_session(:'sid'::uuid);
select id as sid2 from public.create_practice_session('mcq','{}'::jsonb, (select array_agg(('22222222-0000-0000-0000-0000000000'||lpad(g::text,2,'0'))::uuid) from generate_series(3,8) g)) \gset
select count(*) saved from generate_series(3,8) g, lateral public.save_attempt(('22222222-0000-0000-0000-0000000000'||lpad(g::text,2,'0'))::uuid, :'sid2'::uuid, case when g%2=0 then 'A' else 'B' end, true, 20+g, 3::smallint, g%2, 2, null, null, null, g, null, 1, 'test', '{}'::jsonb) a;
select status from public.complete_practice_session(:'sid2'::uuid);
select public.rebuild_candidate_state(:'A') is not null as rebuilt_v2;
select state_version, state->>'evidence_level' lvl, (state->>'evidence_count')::int n, state->'capability'->>'estimate' capability from public.my_pie_state;
\echo '-- re-read (persists) and rebuild again (version increments, still one row)'
select state_version as reread_version from public.my_pie_state;
select public.rebuild_candidate_state(:'A') is not null as rebuilt_v3;
select state_version from public.my_pie_state;
commit;
\echo '-- as postgres: persisted rows for A'
select (select count(*) from public.user_attempts where user_id=:'A') attempts,
       (select count(*) from pie.pie_observation where user_id=:'A') observations,
       (select count(*) from pie.pie_candidate_state where user_id=:'A') state_rows,
       (select max(state_version) from pie.pie_candidate_state where user_id=:'A') state_version,
       (select count(*) from pie.pie_inference_run where user_id=:'A' and status='completed') runs,
       (select string_agg(model_key||'/'||version||'/'||status, ',') from pie.pie_model_version) models;

\echo '### 2. SECURITY as user B'
begin; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true) \g /dev/null
\echo '-- B my_pie_state / get_my_pie_state (expect 0 rows: A has state, B none)'
select count(*) as b_rows from public.my_pie_state;
select count(*) as b_rows_fn from public.get_my_pie_state();
savepoint s;
\echo '-- B rebuilds A via public wrapper (expect User scope violation)'
select public.rebuild_candidate_state(:'A');
rollback to s;
\echo '-- B calls internal pie.rebuild_candidate_state for A (expect permission denied)'
select pie.rebuild_candidate_state(:'A');
rollback to s;
\echo '-- B calls internal pie.rebuild_candidate_state for self (expect permission denied)'
select pie.rebuild_candidate_state(:'B');
rollback to s;
\echo '-- B reads pie.pie_candidate_state (expect permission denied)'
select count(*) from pie.pie_candidate_state;
rollback to s;
\echo '-- B reads pie.pie_observation (expect permission denied)'
select count(*) from pie.pie_observation;
rollback to s;
\echo '-- B writes pie.pie_candidate_state (expect permission denied)'
insert into pie.pie_candidate_state(user_id,state) values (:'B','{}');
rollback to s;
\echo '-- B self-reports evidence via pie.record_observation (expect permission denied)'
select pie.record_observation('MCQ_ATTEMPT','{"outcome":"CORRECT"}'::jsonb);
rollback to s;
\echo '-- B saves an attempt into A''s session (expect not part of an active authenticated practice session)'
select public.save_attempt('22222222-0000-0000-0000-000000000002'::uuid, :'sid'::uuid, 'A', true);
rollback to s;
\echo '-- B rebuilds self: allowed (0 observations -> INSUFFICIENT)'
select public.rebuild_candidate_state(:'B') is not null as b_self;
select user_id = :'B'::uuid as own_row, state_version, state->>'evidence_level' lvl, (state->>'evidence_count')::int n from public.my_pie_state;
commit;

\echo '### 3. A still sees only A after B has a state; cannot rebuild B'
begin; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
select count(*) rows, bool_and(user_id = :'A'::uuid) only_own from public.my_pie_state;
select count(*) rows_where_b from public.my_pie_state where user_id = :'B'::uuid;
savepoint s;
select public.rebuild_candidate_state(:'B');
rollback to s;
\echo '-- null p_user_id (expect User scope violation)'
select public.rebuild_candidate_state(null);
rollback;

\echo '### 4. anon'
begin; set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true) \g /dev/null
savepoint s;
select * from public.my_pie_state;
rollback to s;
select * from public.get_my_pie_state();
rollback to s;
select public.rebuild_candidate_state(:'A');
rollback to s;
select pie.rebuild_candidate_state(:'A');
rollback to s;
select public.save_attempt('22222222-0000-0000-0000-000000000001'::uuid, null, 'A', true);
rollback;

\echo '### 5. service_role -> internal rebuild. NOTE: live grants service_role no USAGE on schema pie (pre-existing,'
\echo '###    unchanged by 0044), so expect: permission denied for schema pie'
begin; set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true) \g /dev/null
select pie.rebuild_candidate_state(:'A') is not null as service_ok;
rollback;

\echo '### 6. Observation failure is logged (WARNING) and never blocks the attempt'
begin;
alter table pie.pie_observation add constraint tmp_force_failure check (false) not valid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true) \g /dev/null
select id as sidb from public.create_practice_session('mcq','{}'::jsonb, array['22222222-0000-0000-0000-000000000009']::uuid[]) \gset
select id is not null as attempt_saved, is_correct from public.save_attempt('22222222-0000-0000-0000-000000000009'::uuid, :'sidb'::uuid, 'A', null);
reset role;
select (select count(*) from public.user_attempts where user_id=:'B') b_attempts_in_tx,
       (select count(*) from pie.pie_observation where user_id=:'B') b_observations_in_tx;
rollback;

\echo '### 7. Catalog: learner privileges after 0044'
select p.oid::regprocedure fn, p.prosecdef secdef, p.proconfig cfg,
       array(select r.rolname from pg_roles r where r.rolname in ('anon','authenticated','service_role') and has_function_privilege(r.oid,p.oid,'EXECUTE') order by 1) exec_roles
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname,p.proname) in (('pie','rebuild_candidate_state'),('public','rebuild_candidate_state'),('public','get_my_pie_state'),('pie','record_observation'),('public','save_attempt'))
order by 1::text;
select count(*) as learner_privileges_on_pie_tables
from pg_class c join pg_namespace n on n.oid=c.relnamespace, pg_roles r, unnest(array['SELECT','INSERT','UPDATE','DELETE']) pr
where n.nspname='pie' and c.relkind='r' and r.rolname in ('anon','authenticated') and has_table_privilege(r.oid,c.oid,pr);
select count(*) filter (where relrowsecurity) rls_on, count(*) tables from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='pie' and c.relkind='r';
select c.oid::regclass v, c.reloptions, has_table_privilege('authenticated',c.oid,'SELECT') auth_select, has_table_privilege('anon',c.oid,'SELECT') anon_select from pg_class c where c.oid='public.my_pie_state'::regclass;
