\set ON_ERROR_STOP 0
\pset pager off
set role authenticated;
\echo '--- PAID user A'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select * from public.get_my_practice_sessions(10);
select session_id, stem, correct_answer, selected_answer, is_correct from public.get_practice_session_results('40000000-0000-0000-0000-000000000001');
select question_id, subject_name, subtopic_name, selected_answer, is_correct, change_sequence, first_answer_correct, first_differs_from_final from public.get_my_trust_gut_attempts(100);
select session_mode, stem, correct_answer, subtopic_name from public.get_my_review_queue_attempts(100);
select * from public.get_my_attempt_summary(100);
\echo '--- direct table read (expect 42501)'
select stem from public.questions limit 1;
select * from public.get_my_attempt_history(10);
\echo '--- other user session results (expect 42501)'
select * from public.get_practice_session_results('40000000-0000-0000-0000-000000000003');
\echo '--- UNPAID user B (all paid RPCs incl. summary expect 42501)'
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
\set VERBOSITY verbose
select * from public.get_my_practice_sessions(10);
select * from public.get_my_trust_gut_attempts(10);
select * from public.get_my_review_queue_attempts(10);
select * from public.get_practice_session_results('40000000-0000-0000-0000-000000000003');
select subject_name, is_correct from public.get_my_attempt_summary(10);
\set VERBOSITY default
\echo '--- anon (expect permission denied)'
reset role; set role anon;
select * from public.get_my_attempt_summary(10);
select * from public.get_my_trust_gut_attempts(10);
reset role;
\echo '--- grants'
select p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') authd,
  exists(select 1 from aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_exec
 from pg_proc p where p.proname in ('get_my_practice_sessions','get_my_trust_gut_attempts','get_my_review_queue_attempts','get_my_attempt_summary');
