\set ON_ERROR_STOP 0
\pset footer off
\echo '### REPRO on live-schema copy (user A, authenticated, as PostgREST would run it)'
begin; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
select id as sid from public.create_practice_session('mcq','{}'::jsonb, array['22222222-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002']::uuid[]) \gset
\echo '-- save_attempt'
select is_correct from public.save_attempt('22222222-0000-0000-0000-000000000001'::uuid, :'sid'::uuid, 'A', null, 12, 4::smallint, 0, 3, null, null, null, 0, null, 1, 'test', '{}'::jsonb);
commit;
\echo '-- observations persisted for A (as postgres)'
select count(*) observations from pie.pie_observation where user_id='aaaaaaaa-0000-0000-0000-00000000000a';
begin; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
savepoint s;
\echo '-- public.rebuild_candidate_state(self)'
select public.rebuild_candidate_state('aaaaaaaa-0000-0000-0000-00000000000a');
rollback to s;
\echo '-- (same fault via direct pie.rebuild_candidate_state)'
select pie.rebuild_candidate_state('aaaaaaaa-0000-0000-0000-00000000000a');
rollback to s;
\echo '-- public.my_pie_state read'
select * from public.my_pie_state;
rollback;
\echo '-- candidate states (as postgres)'
select count(*) candidate_states from pie.pie_candidate_state;
