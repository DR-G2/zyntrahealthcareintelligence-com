-- LOCAL ONLY. 0059 diagnostic blueprint balance on the real ZQ bank.
\set ON_ERROR_STOP 1
\pset tuples_only on
insert into auth.users(id,email) values ('99999999-0000-0000-0000-000000000002','d2@test.local') on conflict do nothing;
insert into public.profiles(id,email,role,status) values ('99999999-0000-0000-0000-000000000002','d2@test.local','learner','active') on conflict do nothing;
begin;
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000002","role":"authenticated"}', true) \g /dev/null
set local role authenticated;
select session_id as ds, question_count as dn from public.pie_create_session(30, 'AMC_CAT_MCQ', 'pie_diagnostic') \gset
commit;
select public.t_assert(:dn = 30, 'diag built 30: ' || :dn);
create temp view diag_split as
  select q.subject_id, count(*) n,
         max((d.secondary_reasons->'diagnostic_quota'->>'share')::numeric) share
  from public.practice_session_questions psq join public.questions q on q.id = psq.question_id
  join pie.decision_trace d on d.session_id = psq.session_id and d.question_id = psq.question_id
  where psq.session_id = :'ds' group by q.subject_id;
select string_agg(s.name || ' ' || d.n || ' (target ' || round(d.share * 30, 1) || ')', ', ' order by d.n desc) from diag_split d join public.subjects s on s.id = d.subject_id;
select public.t_assert((select count(*) from diag_split) = 6, 'diag covers all 6 groups');
select public.t_assert((select bool_and(abs(n - share * 30) <= 1) from diag_split), 'diag split within 1 item of blueprint target');
select public.t_assert((select max(n) from (select count(*) n from public.practice_session_questions psq join pie.question_lo ql on ql.question_id = psq.question_id and ql.is_primary
  join pie.learning_objective lo on lo.id = ql.lo_id where psq.session_id = :'ds' group by lo.concept_id) t) <= 2, 'diag C1 cap');
select public.t_assert((select bool_and(q.zyntra_id like 'ZQ-%') from public.practice_session_questions psq join public.questions q on q.id = psq.question_id where psq.session_id = :'ds'), 'diag ZQ only');
\echo 'ALL BANK DIAGNOSTIC ASSERTIONS PASSED'
