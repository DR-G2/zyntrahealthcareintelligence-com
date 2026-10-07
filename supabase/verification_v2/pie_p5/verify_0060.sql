-- LOCAL ONLY. 0060 history RPCs: PIE attempts only, keys only for answered questions.
\set ON_ERROR_STOP 1
\pset tuples_only on
\set U '''99999999-0000-0000-0000-000000000060'''
\set V '''99999999-0000-0000-0000-000000000061'''
insert into auth.users(id,email) values (:U,'h60@t'),(:V,'h61@t') on conflict do nothing;
insert into public.profiles(id,email,role,status) values (:U,'h60@t','learner','active'),(:V,'h61@t','learner','active') on conflict do nothing;
update public.questions set explanation = coalesce(explanation, 'EXPL ' || id::text);
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;

\echo '### H0 privileges'
select public.t_assert(not has_function_privilege('anon','public.get_my_attempt_history(integer,timestamptz)','execute'), 'H0 anon history');
select public.t_assert(not has_function_privilege('anon','public.get_my_review_due(integer,integer)','execute'), 'H0 anon review');
select public.t_assert(has_function_privilege('authenticated','public.get_my_attempt_history(integer,timestamptz)','execute'), 'H0 auth history');

-- U: a PIE session of 3, answers only the first 2 (third stays presented-unanswered)
begin; select pg_temp.as_user(:U) \g /dev/null
set local role authenticated;
select session_id as us from public.pie_create_session(3) \gset
do $$ declare q record; i int := 0; begin
  for q in select psq.question_id, psq.session_id from public.practice_session_questions psq join public.practice_sessions ps on ps.id = psq.session_id
           where ps.user_id = '99999999-0000-0000-0000-000000000060' order by psq.position loop
    exit when i = 2;
    perform public.save_attempt(q.question_id, q.session_id, 'A', null, 12 + i, (2 + i)::smallint);
    i := i + 1;
  end loop; end $$;
commit;
-- a legacy (non-PIE) attempt for U, inserted directly (superuser, test-only): must never surface
insert into public.practice_sessions(id, user_id, session_type, status, config, started_at, completed_at)
values ('99999999-6060-0000-0000-000000000001', :U, 'mcq', 'completed', '{}', now() - interval '1 day', now() - interval '1 day');
insert into public.user_attempts(user_id, question_id, session_id, selected_answer, is_correct, created_at)
values (:U, '22222222-0000-0000-0000-000000000018', '99999999-6060-0000-0000-000000000001', 'B', false, now() - interval '1 day');

\echo '### H1 history = PIE attempts only, keys only for answered'
begin; select pg_temp.as_user(:U) \g /dev/null
set local role authenticated;
create temp table h as select * from public.get_my_attempt_history(1000);
commit;
select public.t_assert((select count(*) from h) = 2, 'H1 two PIE attempts: ' || (select count(*) from h));
select public.t_assert(not exists (select 1 from h where session_id = '99999999-6060-0000-0000-000000000001'), 'H1 legacy attempt excluded');
-- session still ACTIVE: correctness is shown, key + explanation are withheld
select public.t_assert((select bool_and(correct_answer is null and explanation is null and is_correct is not null) from h), 'H1 active session withholds key + explanation');
begin; select pg_temp.as_user(:U) \g /dev/null
set local role authenticated;
select public.complete_practice_session(:'us') \g /dev/null
create temp table h2 as select * from public.get_my_attempt_history(1000);
commit;
select public.t_assert((select count(*) from h2) = 2 and (select bool_and(correct_answer is not null and explanation is not null) from h2), 'H1 completed session: answered rows carry key + explanation');
select public.t_assert((select bool_and(h2.correct_answer = q.correct_answer) from h2 join public.questions q on q.id = h2.question_id), 'H1 key is the real key');
select public.t_assert((select array_agg(confidence_level order by created_at) from h) = array[2,3]::smallint[] and (select min(time_taken_seconds) from h) = 12, 'H1 confidence + timing');
select public.t_assert((select bool_and(session_mode = 'adaptive' and lo_id is not null) from h), 'H1 mode + LO');
select public.t_assert(not exists (select 1 from h join public.practice_session_questions psq on psq.session_id = h.session_id and psq.question_id = h.question_id where psq.answered_at is null), 'H1 no unanswered question');
select public.t_assert(not exists (select 1 from h where question_id = (select question_id from public.practice_session_questions where session_id = :'us' and answered_at is null)), 'H1 presented-unanswered key not exposed');

\echo '### H1 another learner sees nothing of U'
begin; select pg_temp.as_user(:V) \g /dev/null
set local role authenticated;
select public.t_assert((select count(*) from public.get_my_attempt_history(1000)) = 0, 'H1 isolation');
select public.t_assert((select count(*) from public.get_my_review_due(100, 365)) = 0, 'H2 isolation');
commit;
begin; select pg_temp.as_user(:U) \g /dev/null
set local role authenticated;
do $$ begin perform public.get_my_attempt_history(0); raise exception 'FAIL H1 limit';
exception when invalid_parameter_value then null; end $$;
commit;

\echo '### H2 review-due from PIE state (learner H fixtures: X2, X3 due)'
begin; select pg_temp.as_user('77777777-0000-0000-0000-000000000007') \g /dev/null
set local role authenticated;
create temp table rd as select * from public.get_my_review_due(100, 0);
create temp table rd14 as select * from public.get_my_review_due(100, 30);
commit;
select public.t_assert((select count(*) from rd) >= 2 and (select bool_and(review_due_at <= now() and overdue_days >= 0) from rd), 'H2 due items, ordered by due date');
select public.t_assert((select count(*) from rd14) > (select count(*) from rd), 'H2 horizon includes upcoming');
\echo 'ALL 0060 ASSERTIONS PASSED'
