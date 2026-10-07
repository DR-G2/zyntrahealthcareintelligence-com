-- LOCAL ONLY. 0059 assertions: diagnostic mode, PIE-only attempts, no client-chosen sets.
\set ON_ERROR_STOP 1
\pset tuples_only on
\set D '''99999999-0000-0000-0000-000000000001'''
insert into auth.users(id,email) values ('99999999-0000-0000-0000-000000000001','d@test.local') on conflict do nothing;
insert into public.profiles(id,email,role,status) values ('99999999-0000-0000-0000-000000000001','d@test.local','learner','active') on conflict do nothing;
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;

\echo '### D3 client-chosen question sets are not callable'
select public.t_assert(not has_function_privilege('authenticated', 'public.create_practice_session(text,jsonb,uuid[])', 'execute'), 'D3 create_practice_session revoked');
select public.t_assert(not has_function_privilege('anon', 'public.create_practice_session(text,jsonb,uuid[])', 'execute'), 'D3 anon create_practice_session');
select public.t_assert(not has_function_privilege('authenticated', 'public.get_practice_question_pool(integer)', 'execute'), 'D3 question pool revoked');

\echo '### D2 save_attempt refuses a non-PIE session'
insert into public.practice_sessions(id, user_id, session_type, status, config, started_at, last_activity_at)
values ('99999999-1111-0000-0000-000000000001', :D, 'mcq', 'active', '{}', now(), now());
insert into public.practice_session_questions(session_id, question_id, position, presented_at)
values ('99999999-1111-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 0, now());
begin; select pg_temp.as_user(:D) \g /dev/null
set local role authenticated;
do $$ begin
  perform public.save_attempt('22222222-0000-0000-0000-000000000001', '99999999-1111-0000-0000-000000000001', 'A', true);
  raise exception 'FAIL D2 legacy session accepted';
exception when insufficient_privilege then
  if sqlerrm not like 'PIE_SESSION_REQUIRED%' then raise; end if;
end $$;
commit;
select public.t_assert(not exists (select 1 from public.user_attempts where session_id = '99999999-1111-0000-0000-000000000001'), 'D2 nothing written');

\echo '### D1 diagnostic mode'
begin; select pg_temp.as_user(:D) \g /dev/null
set local role authenticated;
do $$ begin perform public.pie_create_session(5, 'AMC_CAT_MCQ', 'pie_diagnostic'); raise exception 'FAIL D1 count floor';
exception when invalid_parameter_value then null; end $$;
do $$ begin perform public.pie_create_session(10, 'AMC_CAT_MCQ', 'mock_exam'); raise exception 'FAIL D1 mode check';
exception when invalid_parameter_value then null; end $$;
select session_id as ds, question_count as dn from public.pie_create_session(10, 'AMC_CAT_MCQ', 'pie_diagnostic') \gset
commit;
\echo diagnostic built :dn
select public.t_assert((select mode from pie.adaptive_session where session_id = :'ds') = 'diagnostic', 'D1 registered as diagnostic');
select public.t_assert((select session_type from public.practice_sessions where id = :'ds') = 'pie_diagnostic', 'D1 session_type');
-- fixtures: 3 concepts x C1 cap 2 = 6 (fewer than requested is allowed)
select public.t_assert(:dn = 6, 'D1 C1 cap applies to diagnostics ' || :dn);
select public.t_assert((select bool_and(secondary_reasons ? 'diagnostic_quota') from pie.decision_trace where session_id = :'ds'), 'D1 quota traced');
begin; select pg_temp.as_user(:D) \g /dev/null
set local role authenticated;
do $$ declare s uuid := (select id from public.practice_sessions where user_id = '99999999-0000-0000-0000-000000000001' and session_type = 'pie_diagnostic');
begin
  begin perform public.pie_next_question(s); raise exception 'FAIL D1 next on diagnostic';
  exception when object_not_in_prerequisite_state then if sqlerrm not like 'PIE_DIAGNOSTIC_FIXED%' then raise; end if; end;
end $$;
commit;
update pie.session_create_throttle set last_created_at = now() - interval '1 minute' where user_id = :D;
begin; select pg_temp.as_user(:D) \g /dev/null
set local role authenticated;
do $$ begin perform public.pie_create_session(10, 'AMC_CAT_MCQ', 'pie_diagnostic'); raise exception 'FAIL D1 second active diagnostic';
exception when sqlstate '53400' then if sqlerrm not like 'PIE_DIAGNOSTIC_ACTIVE%' then raise; end if; end $$;
commit;

\echo '### D1 diagnostic attempts are PIE evidence'
begin; select pg_temp.as_user(:D) \g /dev/null
set local role authenticated;
do $$ declare q record; i int := 0; begin
  for q in select psq.question_id from public.practice_session_questions psq
           join public.practice_sessions ps on ps.id = psq.session_id
           where ps.user_id = '99999999-0000-0000-0000-000000000001' and ps.session_type = 'pie_diagnostic' order by psq.position loop
    perform public.save_attempt(q.question_id, (select id from public.practice_sessions where user_id = '99999999-0000-0000-0000-000000000001' and session_type = 'pie_diagnostic'),
                                case when i % 2 = 0 then 'A' else 'B' end, null, 30, 3::smallint);
    i := i + 1;
  end loop;
end $$;
select public.complete_practice_session(:'ds') \g /dev/null
commit;
select pie.recompute_learner_lo_state(:D) \g /dev/null
select public.t_assert((select coalesce(sum(source_attempt_count), 0) from pie.learner_lo_state where user_id = :D) = 6, 'D1 all 6 diagnostic attempts counted as evidence');
select public.t_assert((select count(*) from pie.learner_lo_state where user_id = :D and review_due_at is not null) > 0, 'D1 scheduler runs on diagnostic evidence');
-- 24 h diagnostic throttle (30 s create throttle cleared, no active diagnostic)
update pie.session_create_throttle set last_created_at = now() - interval '1 minute' where user_id = :D;
begin; select pg_temp.as_user(:D) \g /dev/null
set local role authenticated;
do $$ begin perform public.pie_create_session(10, 'AMC_CAT_MCQ', 'pie_diagnostic'); raise exception 'FAIL D1 24 h throttle';
exception when sqlstate '53400' then if sqlerrm not like 'PIE_DIAGNOSTIC_RATE_LIMITED%' then raise; end if; end $$;
-- adaptive practice is still available
select public.t_assert((select question_count from public.pie_create_session(2)) = 2, 'D1 adaptive still works');
commit;
\echo 'ALL 0059 ASSERTIONS PASSED'
