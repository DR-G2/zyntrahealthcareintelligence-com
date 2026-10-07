-- LOCAL ONLY. 0054 assertions (run after verify_0053.sql). Any failure aborts.
\set ON_ERROR_STOP 1
\pset tuples_only on
\set G '''99999999-0000-0000-0000-000000000009'''
insert into auth.users(id,email) values ('99999999-0000-0000-0000-000000000009','g@test.local') on conflict do nothing;
insert into public.profiles(id,email,role,status) values ('99999999-0000-0000-0000-000000000009','g@test.local','learner','active') on conflict do nothing;
create or replace function pg_temp.g_create() returns uuid language plpgsql as $$
declare s uuid; begin
  delete from pie.session_create_throttle where user_id = '99999999-0000-0000-0000-000000000009';
  perform set_config('request.jwt.claims','{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}',true);
  set local role authenticated;
  select session_id into s from public.pie_create_session(1);
  reset role;
  return s;
end $$;
create or replace function pg_temp.g_resume(s uuid) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims','{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}',true);
  set local role authenticated;
  begin perform public.resume_practice_session(s); reset role; return 'ok';
  exception when others then reset role; return sqlstate || ' ' || sqlerrm; end;
end $$;

\echo '### R1a abandoned adaptive session cannot be resumed'
select pg_temp.g_create() as g1 \gset
update public.practice_sessions set status='abandoned' where id=:'g1';
select pg_temp.g_resume(:'g1') as r \gset
select public.t_assert(:'r' like '55000 PIE_SESSION_EXPIRED%', 'R1a abandoned resume: ' || :'r');
select public.t_assert((select status from public.practice_sessions where id=:'g1')='abandoned', 'R1a still abandoned');

\echo '### R1b auto-expired (stale > 2 h) adaptive session cannot be resumed'
select pg_temp.g_create() as g2 \gset
update public.practice_sessions set status='paused', last_activity_at = now() - interval '3 hours' where id=:'g2';
update public.practice_sessions set status='active' where id=:'g2';  -- active but stale
select pg_temp.g_resume(:'g2') as r \gset
select public.t_assert(:'r' like '55000 PIE_SESSION_EXPIRED%', 'R1b stale resume: ' || :'r');
-- the refusal rolls back; the session stays stale (not refreshed) and is closed by the next create
select public.t_assert((select last_activity_at < now() - interval '2 hours' from public.practice_sessions where id=:'g2'), 'R1b not refreshed');
select pg_temp.g_create() as gx \gset
select public.t_assert((select status from public.practice_sessions where id=:'g2')='abandoned', 'R1b expired by next create');
update public.practice_sessions set status='completed', completed_at=now() where id=:'gx';

\echo '### R1c adaptive resume enforces the 3-active cap'
select pg_temp.g_create() as g3 \gset
update public.practice_sessions set status='paused' where id=:'g3';
select pg_temp.g_create() as g4 \gset
select pg_temp.g_create() as g5 \gset
select pg_temp.g_create() as g6 \gset
select public.t_assert((select count(*) from pie.adaptive_session a join public.practice_sessions ps on ps.id=a.session_id where a.user_id=:G and ps.status='active') = 3, 'R1c 3 active');
select pg_temp.g_resume(:'g3') as r \gset
select public.t_assert(:'r' like '53400 PIE_TOO_MANY_ACTIVE_SESSIONS%', 'R1c over-cap resume: ' || :'r');
select public.t_assert((select status from public.practice_sessions where id=:'g3')='paused', 'R1c still paused');
-- an already-active session can be "resumed" (touch) at the cap
select public.t_assert(pg_temp.g_resume(:'g4') = 'ok', 'R1c resume of active session at cap');
update public.practice_sessions set status='completed', completed_at=now() where id=:'g6';
select pg_temp.g_resume(:'g3') as r \gset
select public.t_assert(:'r' = 'ok' and (select status from public.practice_sessions where id=:'g3')='active', 'R1c resume under cap: ' || :'r');

\echo '### R1d legacy (non-adaptive) resume unchanged'
begin;
select set_config('request.jwt.claims','{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select (public.create_practice_session('mcq','{}'::jsonb, array['22222222-0000-0000-0000-000000000007'::uuid])).id as lg \gset
commit;
update public.practice_sessions set status='abandoned' where id=:'lg';
select public.t_assert(pg_temp.g_resume(:'lg') = 'ok', 'R1d legacy resume');

\echo '### O1 PIE_NO_ELIGIBLE_CANDIDATE counter (admin-only)'
select selector_calls as c0, no_eligible_candidate_failures as f0 from pie.selector_failure_stats \gset
update public.practice_sessions set status='completed', completed_at=now() where id in (:'g3', :'g4', :'g5', :'lg');
create temp table q_saved as select id, status from public.questions;
update public.questions set status='retired';
do $$ begin
  delete from pie.session_create_throttle where user_id = '99999999-0000-0000-0000-000000000009';
  perform set_config('request.jwt.claims','{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}',true);
  set local role authenticated;
  begin perform public.pie_create_session(1); raise exception 'FAIL O1 expected no candidate';
  exception when no_data_found then null; end;
end $$;
update public.questions q set status = s.status from q_saved s where s.id = q.id;
select public.t_assert((select no_eligible_candidate_failures from pie.selector_failure_stats) = :f0 + 1, 'O1 failure counted (survives rollback)');
select public.t_assert((select selector_calls from pie.selector_failure_stats) = :c0 + 1, 'O1 call counted');
select pg_temp.g_create() \g /dev/null
select public.t_assert((select selector_calls from pie.selector_failure_stats) = :c0 + 2
  and (select no_eligible_candidate_failures from pie.selector_failure_stats) = :f0 + 1, 'O1 success counted as call only');
select public.t_assert((select failure_rate from pie.selector_failure_stats) between 0 and 1, 'O1 rate');
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}',true);
  set local role authenticated;
  begin perform 1 from pie.selector_failure_stats; raise exception 'FAIL O1 learner read view';
  exception when insufficient_privilege then null; end;
  begin perform nextval('pie.selector_failure_seq'); raise exception 'FAIL O1 learner bumped counter';
  exception when insufficient_privilege then null; end;
  begin perform pie.note_selector_failure('99999999-0000-0000-0000-000000000009', null, 'X'); raise exception 'FAIL O1 learner note';
  exception when insufficient_privilege then null; end;
end $$;
select public.t_assert(has_table_privilege('service_role','pie.selector_failure_stats','select'), 'O1 service_role can read');
select public.t_assert(not has_table_privilege('anon','pie.selector_failure_stats','select'), 'O1 anon denied');
\echo 'ALL 0054 ASSERTIONS PASSED'
