-- LOCAL ONLY. P5 assertions (policy pie-select/p5.0). Any failure aborts.
\set ON_ERROR_STOP 1
\pset tuples_only on
\set A '''aaaaaaaa-0000-0000-0000-00000000000a'''
\set H '''77777777-0000-0000-0000-000000000007'''
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;

\echo '### P5.0 active policy'
select public.t_assert(pie.active_policy() = 'pie-select/p5.0', 'p5.0 active');
select public.t_assert((select status from pie.selection_policy where policy_version='pie-select/p3.0') = 'retired', 'p3.0 retired');

\echo '### F1 learners cannot read explanation / correct_answer from questions'
select public.t_assert(not has_column_privilege('authenticated','public.questions','explanation','select'), 'F1 explanation column');
select public.t_assert(not has_column_privilege('authenticated','public.questions','correct_answer','select'), 'F1 key column');
select public.t_assert(not has_column_privilege('anon','public.questions','explanation','select'), 'F1 anon explanation');
select public.t_assert((select reloptions from pg_class where oid='public.questions_for_learner'::regclass) @> array['security_invoker=true'], 'F1 view security_invoker');
update public.questions set explanation = 'SECRET EXPLANATION';
begin; select pg_temp.as_user(:A) \g /dev/null
set local role authenticated;
do $$ begin
  begin perform explanation from public.questions limit 1; raise exception 'FAIL F1 explanation readable';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.questions_for_learner where explanation is not null) then raise exception 'FAIL F1 view leaks explanation'; end if;
  if (select count(*) from public.questions_for_learner) = 0 then raise exception 'FAIL F1 view unusable'; end if;
end $$;
commit;

\echo '### C1 at most 2 per concept per session, only from different LOs'
begin; select pg_temp.as_user(:A) \g /dev/null
set local role authenticated;
select session_id as s1, question_count as n1 from public.pie_create_session(10) \gset
commit;
\echo n1 = :n1
create temp view s1_q as select psq.question_id, ql.lo_id, lo.concept_id from public.practice_session_questions psq
  join pie.question_lo ql on ql.question_id = psq.question_id and ql.is_primary join pie.learning_objective lo on lo.id = ql.lo_id
  where psq.session_id = :'s1';
select public.t_assert((select max(n) from (select count(*) n from s1_q group by concept_id) t) <= 2, 'C1 concept cap');
select public.t_assert((select count(*) = count(distinct lo_id) from s1_q), 'C1 distinct LOs');
-- HF (2 LOs) -> 2, AKI (1 LO) -> 1, X (3 LOs) -> 2 = 5, although 10 were requested and more are eligible
select public.t_assert(:n1 = 5, 'C1 session size ' || :n1);
select public.t_assert((select (rejected_candidates->'ineligible_counts') ?| array['concept_session_cap','lo_already_in_session']
  from pie.decision_trace where session_id = :'s1' order by created_at desc limit 1), 'C1 rejections traced');
create or replace function pg_temp.answer_all(s uuid) returns void language plpgsql as $$
declare q uuid; begin
  for q in select psq.question_id from public.practice_session_questions psq where psq.session_id = s and psq.answered_at is null loop
    perform public.save_attempt(q, s, 'A', false, 20, 4::smallint);
  end loop; end $$;
begin; select pg_temp.as_user(:A) \g /dev/null
set local role authenticated;
select pg_temp.answer_all(:'s1') \g /dev/null
commit;
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true);
  set local role authenticated;
  begin perform public.pie_next_question((select id from public.practice_sessions where user_id='aaaaaaaa-0000-0000-0000-00000000000a' and session_type='pie_adaptive' and status='active' limit 1));
    raise exception 'FAIL C1 next_question broke the concept cap';
  exception when no_data_found then null; end;
end $$;

\echo '### S1 spaced-review schedule (design defaults)'
-- Learner H: completed adaptive history built directly (superuser, test-only).
insert into public.practice_sessions(id, user_id, session_type, status, config, started_at, completed_at, last_activity_at)
values ('55555555-0000-0000-0000-000000000001', :H, 'pie_adaptive', 'completed', '{}', now() - interval '20 days', now() - interval '19 days', now() - interval '19 days'),
       ('55555555-0000-0000-0000-000000000002', :H, 'pie_adaptive', 'completed', '{}', now() - interval '10 days', now() - interval '9 days', now() - interval '9 days');
insert into pie.adaptive_session(session_id, user_id, policy_version, blueprint_key)
values ('55555555-0000-0000-0000-000000000001', :H, 'pie-select/p5.0', 'AMC_CAT_MCQ'), ('55555555-0000-0000-0000-000000000002', :H, 'pie-select/p5.0', 'AMC_CAT_MCQ');
insert into public.practice_session_questions(session_id, question_id, position, presented_at, answered_at) values
 ('55555555-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000013',0, now()-interval '20 days', now()-interval '20 days'),
 ('55555555-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000015',1, now()-interval '20 days', now()-interval '20 days'),
 ('55555555-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000017',2, now()-interval '20 days', now()-interval '20 days'),
 ('55555555-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000014',0, now()-interval '10 days', now()-interval '10 days');
insert into public.user_attempts(user_id, question_id, session_id, selected_answer, is_correct, confidence_level, created_at) values
 (:H,'22222222-0000-0000-0000-000000000013','55555555-0000-0000-0000-000000000001','A',true, 4, now()-interval '20 days'),  -- X1 right
 (:H,'22222222-0000-0000-0000-000000000015','55555555-0000-0000-0000-000000000001','B',false,4, now()-interval '20 days'),  -- X2 wrong -> 1 d (due)
 (:H,'22222222-0000-0000-0000-000000000017','55555555-0000-0000-0000-000000000001','A',true, 1, now()-interval '20 days'),  -- X3 right low conf -> 3 d
 (:H,'22222222-0000-0000-0000-000000000014','55555555-0000-0000-0000-000000000002','A',true, 5, now()-interval '10 days');  -- X1 right again -> 14 d
select pie.recompute_learner_lo_state(:H) \g /dev/null
select public.t_assert(abs(extract(epoch from (select review_due_at from pie.learner_lo_state where user_id=:H and lo_id='10000000-0000-0000-0000-000000000012') - (now() - interval '19 days'))) < 5, 'S1 wrong -> +1 d');
select public.t_assert(abs(extract(epoch from (select review_due_at from pie.learner_lo_state where user_id=:H and lo_id='10000000-0000-0000-0000-000000000013') - (now() - interval '17 days'))) < 5, 'S1 right low conf -> +3 d');
select public.t_assert(abs(extract(epoch from (select review_due_at from pie.learner_lo_state where user_id=:H and lo_id='10000000-0000-0000-0000-000000000011') - (now() + interval '4 days'))) < 5, 'S1 right x2 -> 7 d doubled to 14 d');
select public.t_assert(pie.compute_review_due(:H, '10000000-0000-0000-0000-000000000001') is null, 'S1 no history -> null');

\echo '### C3 due review outranks unseen'
-- X2 and X3 are due; X1 is not; HF/AKI LOs are unseen for H (higher unseen value)
begin; select pg_temp.as_user(:H) \g /dev/null
set local role authenticated;
select session_id as hs from public.pie_create_session(3) \gset
commit;
select string_agg(primary_reasons->>'hierarchy' || ':' || lo_id, ',' order by created_at) as hh from pie.decision_trace where session_id=:'hs' \gset
\echo :hh
select public.t_assert((select array_agg(primary_reasons->>'hierarchy' order by created_at) from (select * from pie.decision_trace where session_id=:'hs' order by created_at limit 2) t)
  = array['review_due','review_due'], 'C3 the two due reviews come first');
select public.t_assert((select bool_and((secondary_reasons->'review_priority'->>'value')::int = 1) from (select * from pie.decision_trace where session_id=:'hs' order by created_at limit 2) t), 'C3 priority traced');
select public.t_assert(exists (select 1 from pie.decision_trace d, jsonb_array_elements(d.rejected_candidates->'top_eligible') e
  where d.session_id=:'hs' and e->>'hierarchy' = 'unseen_concept' order by 1 limit 1), 'C3 unseen candidates were eligible');
select public.t_assert((select primary_reasons->>'hierarchy' from pie.decision_trace where session_id=:'hs' order by created_at offset 2 limit 1) <> 'review_due', 'C3 then unseen/new content');
\echo 'ALL P5 ASSERTIONS PASSED'
