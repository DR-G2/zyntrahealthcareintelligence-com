-- LOCAL ONLY. 0053 assertions (run after verify_p3.sql). Any failure aborts.
\set ON_ERROR_STOP 1
\pset tuples_only on
\set D '''dddddddd-0000-0000-0000-00000000000d'''
insert into auth.users(id,email) values ('dddddddd-0000-0000-0000-00000000000d','d@test.local') on conflict do nothing;
insert into public.profiles(id,email,role,status) values ('dddddddd-0000-0000-0000-00000000000d','d@test.local','learner','active') on conflict do nothing;
create or replace function pg_temp.as_d() returns void language sql as $$
  select set_config('request.jwt.claims','{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}',true) $$;

\echo '### P1 peek: complete an adaptive session without answering -> no key for unanswered'
begin; select pg_temp.as_d() \g /dev/null
set local role authenticated;
select session_id as s1 from public.pie_create_session(2) \gset
select public.save_attempt((select question_id from public.practice_session_questions where session_id=:'s1' order by position limit 1), :'s1', 'A', false) \g /dev/null
select public.complete_practice_session(:'s1') \g /dev/null
create temp table r1 as select * from public.get_practice_session_results(:'s1');
commit;
select public.t_assert((select count(*) from r1) = 2, 'P1 two result rows');
select public.t_assert((select count(*) from r1 where selected_answer is null and (correct_answer is not null or explanation is not null)) = 0, 'P1 key/explanation leaked for unanswered');
select public.t_assert((select count(*) from r1 where selected_answer is not null and correct_answer is not null) = 1, 'P1 key returned for answered (control)');
select question_id as peeked from r1 where selected_answer is null \gset

\echo '### P2 peeked question is never re-served by PIE'
delete from pie.session_create_throttle;
begin; select pg_temp.as_d() \g /dev/null
set local role authenticated;
select session_id as s2 from public.pie_create_session(50) \gset
commit;
select public.t_assert(not exists (select 1 from public.practice_session_questions where session_id=:'s2' and question_id=:'peeked'), 'P2 peeked question re-served');
select public.t_assert((select (rejected_candidates->'ineligible_counts'->>'presented_unanswered')::int from pie.decision_trace where session_id=:'s2' order by created_at limit 1) >= 1, 'P2 presented_unanswered traced');

\echo '### P3 peeked question answered later (legacy path, even if treated as adaptive) is not evidence'
begin; select pg_temp.as_d() \g /dev/null
set local role authenticated;
select (public.create_practice_session('mcq','{}'::jsonb, array[:'peeked'::uuid])).id as s3 \gset
select public.save_attempt(:'peeked', :'s3', 'A', false) \g /dev/null
select public.complete_practice_session(:'s3') \g /dev/null
commit;
-- worst case for the evidence gate: the session is registered as adaptive (test-only)
insert into pie.adaptive_session(session_id, user_id, policy_version, blueprint_key) values (:'s3', :D, 'pie-select/p3.0', 'AMC_CAT_MCQ');
select public.t_assert(not exists (select 1 from pie.first_exposure_attempt_ids(:D) f join public.user_attempts ua on ua.id=f.id where ua.question_id=:'peeked'), 'P3 peeked attempt counted as first exposure');
select public.t_assert(exists (select 1 from pie.first_exposure_attempt_ids(:D)), 'P3 the genuine first exposure (answered in s1) still counts');
select pie.recompute_learner_lo_state(:D) \g /dev/null
select public.t_assert((select coalesce(sum(exposure_count),0) from pie.learner_lo_state where user_id=:D) >= 1
  and not exists (select 1 from pie.learner_lo_state s, jsonb_array_elements(s.outcome_history) e where s.user_id=:D and e->>'question_id' = :'peeked'), 'P3 peeked question in LO state');

\echo '### P4 every learner RPC returning key columns is answered-gated'
select public.t_assert(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','pie','amc','intelligence') and has_function_privilege('authenticated', p.oid, 'execute')
    and p.prosrc ~* 'q\.correct_answer|q\.explanation'
    and p.proname not in ('get_practice_session_results','save_attempt')), 'P4 unexpected key-returning RPC');
select public.t_assert(pg_get_functiondef('public.get_practice_session_results(uuid)'::regprocedure) like '%when ua.selected_answer is not null then q.correct_answer%', 'P4 results gated');

\echo '### N1 null decide -> clear error'
delete from pie.session_create_throttle;
do $$ declare s uuid; begin
  select a.session_id into s from pie.adaptive_session a join public.practice_sessions ps on ps.id = a.session_id
   where a.user_id = 'dddddddd-0000-0000-0000-00000000000d' and ps.status = 'active';
  perform pg_temp.as_d(); set local role authenticated;
  -- answer everything in s2, then the pool is exhausted
  perform public.save_attempt(psq.question_id, s, 'A', false) from public.practice_session_questions psq where psq.session_id = s and psq.answered_at is null;
  begin perform public.pie_next_question(s); raise exception 'FAIL N1 exhausted pool returned a question';
  exception when no_data_found then
    if sqlerrm not like 'PIE_NO_ELIGIBLE_CANDIDATE%' then raise exception 'FAIL N1 unclear error: %', sqlerrm; end if;
  end;
end $$;

\echo '### X1 stale adaptive sessions (inactive > 2 h) are auto-closed before the cap'
-- learner C has 3 active adaptive sessions after E3b
select public.t_assert((select count(*) from pie.adaptive_session a join public.practice_sessions ps on ps.id=a.session_id where a.user_id='cccccccc-0000-0000-0000-00000000000c' and ps.status='active') = 3, 'X1 precondition 3 active');
update public.practice_sessions set last_activity_at = now() - interval '2 hours 1 minute'
 where id = (select a.session_id from pie.adaptive_session a join public.practice_sessions ps on ps.id=a.session_id where a.user_id='cccccccc-0000-0000-0000-00000000000c' and ps.status='active' order by a.created_at limit 1)
returning id as stale \gset
update public.questions set status='active' where id='22222222-0000-0000-0000-000000000005';
delete from pie.pie_question_quarantine;
delete from pie.session_create_throttle;
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}',true);
  set local role authenticated; perform public.pie_create_session(1);
end $$;
select public.t_assert((select status from public.practice_sessions where id=:'stale') = 'abandoned', 'X1 stale session closed');
select public.t_assert((select count(*) from pie.adaptive_session a join public.practice_sessions ps on ps.id=a.session_id where a.user_id='cccccccc-0000-0000-0000-00000000000c' and ps.status='active') = 3, 'X1 cap still 3');
-- a session at 1h59m is NOT stale
update public.practice_sessions set last_activity_at = now() - interval '1 hour 59 minutes'
 where id = (select a.session_id from pie.adaptive_session a join public.practice_sessions ps on ps.id=a.session_id where a.user_id='cccccccc-0000-0000-0000-00000000000c' and ps.status='active' order by a.created_at limit 1);
delete from pie.session_create_throttle;
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}',true);
  set local role authenticated;
  begin perform public.pie_create_session(1); raise exception 'FAIL X1 non-stale session expired';
  exception when sqlstate '53400' then null; end;
end $$;
\echo 'ALL 0053 ASSERTIONS PASSED'
