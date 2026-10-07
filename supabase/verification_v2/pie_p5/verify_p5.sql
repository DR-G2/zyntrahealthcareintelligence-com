-- LOCAL ONLY. P5 assertions (policy pie-select/p5.1). Any failure aborts.
\set ON_ERROR_STOP 1
\pset tuples_only on
\set A '''aaaaaaaa-0000-0000-0000-00000000000a'''
\set H '''77777777-0000-0000-0000-000000000007'''
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;

\echo '### P5.0 active policy'
select public.t_assert(pie.active_policy() = 'pie-select/p5.1', 'p5.1 active');
select public.t_assert((select status from pie.selection_policy where policy_version='pie-select/p3.0') = 'retired', 'p3.0 retired');
select public.t_assert((select status from pie.selection_policy where policy_version='pie-select/p5.0') = 'retired', 'p5.0 retired');

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

\echo '### C1 at most 2 per concept per session; same-LO allowed (no distinct-LO rule)'
begin; select pg_temp.as_user(:A) \g /dev/null
set local role authenticated;
select session_id as s1, question_count as n1 from public.pie_create_session(10) \gset
commit;
\echo n1 = :n1
create temp view s1_q as select psq.question_id, ql.lo_id, lo.concept_id from public.practice_session_questions psq
  join pie.question_lo ql on ql.question_id = psq.question_id and ql.is_primary join pie.learning_objective lo on lo.id = ql.lo_id
  where psq.session_id = :'s1';
select public.t_assert((select max(n) from (select count(*) n from s1_q group by concept_id) t) <= 2, 'C1 concept cap');
-- HF, AKI, X each have >= 2 questions -> 3 concepts x 2 = 6 (AKI has a single LO, so this needs same-LO pairs)
select public.t_assert(:n1 = 6, 'C1 session size ' || :n1);
select public.t_assert((select count(*) from s1_q where concept_id = 'c0000000-0000-0000-0000-000000000002') = 2, 'C1 same-LO second question allowed (AKI)');
select public.t_assert((select bool_and(not (rejected_candidates->'ineligible_counts') ? 'lo_already_in_session')
  and bool_or((rejected_candidates->'ineligible_counts') ? 'concept_session_cap') from pie.decision_trace where session_id = :'s1'), 'C1 cap traced, no LO rule');
select public.t_assert((select count(*) from pie.decision_trace where session_id = :'s1' and secondary_reasons ? 'confirmation_probe'
  and secondary_reasons->'confirmation_probe'->>'reason' = 'first_unanswered') = 3, 'C1 batch-built second items traced first_unanswered');
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

\echo '### C3 single comparable learner value (no fixed review rule)'
select weights as pw from pie.selection_policy where policy_version = 'pie-select/p5.1' \gset
select public.t_assert(((:'pw')::jsonb->>'review_priority')::numeric = 0 and ((:'pw')::jsonb->'secondary'->>'review_due')::numeric = 0, 'C3 no fixed review bonus');
-- formula: unseen concept V = 0.5 + 1.0*0.5 = 1.0
select public.t_assert((pie.learner_value(:'pw', null, null, null, 0, 0, 0, 1.0)->>'value')::numeric = 1.0, 'C3 unseen concept V=1.0');
-- just-due, well-mastered review (O = 0.5) LOSES to an unseen concept
select public.t_assert((pie.learner_value(:'pw', 0.9, now() - interval '7 days', now(), 4, 0, 0, 0.3)->>'value')::numeric < 1.0, 'C3 mastered due review < unseen');
select public.t_assert(abs((pie.learner_value(:'pw', 0.9, now() - interval '7 days', now(), 4, 0, 0, 0.3)->>'O')::numeric - 0.5) < 0.001, 'C3 O=0.5 at due');
-- weak, long-overdue, miscalibrated review BEATS an unseen concept
select public.t_assert((pie.learner_value(:'pw', 0.3, now() - interval '20 days', now() - interval '19 days', 2, 1, 0, 0.3)->>'value')::numeric > 1.0, 'C3 weak overdue review > unseen');
-- not-yet-due review still scores continuously (O between 0 and 0.5)
select public.t_assert((pie.learner_value(:'pw', 0.5, now() - interval '1 day', now() + interval '6 days', 1, 0, 0, 0.3)->>'O')::numeric between 0.01 and 0.5, 'C3 O continuous before due');

-- Learner H: X2 (wrong, 19 d overdue) and X3 (right low-conf, 17 d overdue) vs unseen HF/AKI
begin; select pg_temp.as_user(:H) \g /dev/null
set local role authenticated;
select session_id as hs from public.pie_create_session(3) \gset
commit;
select string_agg((primary_reasons->'comparison'->>'winner_class') || ':' || (total_score) || ' ' || (primary_reasons->'comparison'->>'why'), E'\n' order by created_at) as hh from pie.decision_trace where session_id=:'hs' \gset
\echo :hh
select public.t_assert((select array_agg(primary_reasons->'comparison'->>'winner_class' order by created_at) from (select * from pie.decision_trace where session_id=:'hs' order by created_at limit 2) t)
  = array['review','review'], 'C3 weak overdue reviews win on score');
select public.t_assert((select bool_and(primary_reasons->'comparison'->>'decided_by' = 'total_score' and primary_reasons->'comparison' ? 'best_unseen'
  and (primary_reasons->'comparison'->'best_unseen'->>'total')::numeric < total_score and primary_reasons ? 'learner_value'
  and primary_reasons->'comparison'->>'why' like 'review won%') from (select * from pie.decision_trace where session_id=:'hs' order by created_at limit 2) t), 'C3 comparison traced');
select public.t_assert((select primary_reasons->'comparison'->>'winner_class' from pie.decision_trace where session_id=:'hs' order by created_at offset 2 limit 1) = 'unseen', 'C3 then unseen (X capped)');

\echo '### C1 confirmation probe'
insert into auth.users(id,email) select ('88888888-0000-0000-0000-00000000000'||g)::uuid, 'p'||g||'@test.local' from generate_series(1,3) g on conflict do nothing;
insert into public.profiles(id,email,role,status) select ('88888888-0000-0000-0000-00000000000'||g)::uuid, 'p'||g||'@test.local','learner','active' from generate_series(1,3) g on conflict do nothing;
create or replace function pg_temp.probe(u uuid, conf smallint, secs integer) returns jsonb language plpgsql as $$
declare s uuid; q1 uuid; c1 uuid; r record; begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select session_id into s from public.pie_create_session(1);
  select psq.question_id into q1 from public.practice_session_questions psq where psq.session_id = s;
  perform public.save_attempt(q1, s, 'A', true, secs, conf);
  perform public.pie_next_question(s);
  reset role;
  select lo.concept_id into c1 from pie.question_lo ql join pie.learning_objective lo on lo.id = ql.lo_id where ql.question_id = q1 and ql.is_primary;
  select * into r from pie.decision_trace d where d.session_id = s order by d.created_at desc limit 1;
  return jsonb_build_object('same_concept', r.concept_id = c1, 'probe', r.secondary_reasons->'confirmation_probe', 'first', q1);
end $$;
select pg_temp.probe('88888888-0000-0000-0000-000000000001', 1::smallint, 40) as p1 \gset
select pg_temp.probe('88888888-0000-0000-0000-000000000002', 4::smallint, 3) as p2 \gset
select pg_temp.probe('88888888-0000-0000-0000-000000000003', 5::smallint, 60) as p3 \gset
\echo guessing: :p1
\echo fast: :p2
\echo confident: :p3
select public.t_assert((:'p1')::jsonb->>'same_concept' = 'true' and (:'p1')::jsonb->'probe'->>'applied' = 'true'
  and (:'p1')::jsonb->'probe'->>'reason' = 'correct_low_confidence' and (:'p1')::jsonb->'probe'->>'first_question_id' = (:'p1')::jsonb->>'first', 'C1 probe after Guessing-correct');
select public.t_assert((:'p2')::jsonb->>'same_concept' = 'true' and (:'p2')::jsonb->'probe'->>'reason' = 'correct_fast', 'C1 probe after fast-correct');
select public.t_assert(coalesce((:'p3')::jsonb->'probe'->>'applied', 'false') = 'false'
  and ((:'p3')::jsonb->>'same_concept' = 'false' or (:'p3')::jsonb->'probe'->>'reason' = 'first_correct_confident'), 'C1 no probe after confident, unhurried correct');
\echo 'ALL P5 ASSERTIONS PASSED'
