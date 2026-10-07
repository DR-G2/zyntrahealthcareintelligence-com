-- LOCAL ONLY. P3 stage assertions. Any failure aborts.
\set ON_ERROR_STOP 1
\pset pager off
\pset tuples_only on
\echo '### S0 readiness tables moved to amc.*, no learner access; 0050 constraints'
select public.t_assert(to_regclass('amc.amc_learner_readiness') is not null and to_regclass('pie.pie_exam_readiness') is null, 'readiness moved');
select public.t_assert(to_regclass('amc.amc_learner_exam_environment') is not null and to_regclass('amc.amc_learner_adapter_snapshot') is not null, 'env/snapshot moved');
select public.t_assert(not has_table_privilege('authenticated','amc.amc_learner_readiness','select'), 'no learner select on readiness');
select public.t_assert((select count(*) from pg_constraint where conname='questions_irt_b_source_check') = 1, 'single irt_b_source check');
select public.t_assert((select count(*) from pg_constraint c join pg_class t on t.oid=c.conrelid
  where t.relname='questions' and c.contype='c' and pg_get_constraintdef(c.oid) like '%expert_prior%') = 1, 'no stale irt_b_source check');
do $$ begin
  begin update public.questions set irt_b_source='bogus' where id='22222222-0000-0000-0000-000000000001'; raise exception 'FAIL S0 bogus source';
  exception when check_violation then null; end;
end $$;
update public.questions set irt_b_source='tier_prior' where id='22222222-0000-0000-0000-000000000012';

\echo '### S1 hard eligibility'
update public.questions set status='retired' where id='22222222-0000-0000-0000-000000000004';
insert into pie.pie_question_quarantine(question_id, reason) values ('22222222-0000-0000-0000-000000000005','test');
insert into amc.amc_blueprint_lo(blueprint_id, lo_id, eligible, coverage_target, tie_break_rank)
select b.id, '10000000-0000-0000-0000-000000000003', false, null, null from amc.amc_blueprint b where blueprint_key='AMC_CAT_MCQ';
begin;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select session_id as bsid, question_count as bn from public.pie_create_session(5) \gset
commit;
select public.t_assert(:bn = 5, 'S1 5 questions built');
select public.t_assert((select count(distinct question_id) from public.practice_session_questions where session_id=:'bsid') = 5, 'S1 distinct');
select public.t_assert(not exists (select 1 from public.practice_session_questions where session_id=:'bsid'
  and question_id in ('22222222-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000005')), 'S1 retired/quarantined excluded');
select public.t_assert(not exists (select 1 from public.practice_session_questions psq join pie.question_lo ql on ql.question_id=psq.question_id and ql.is_primary
  where psq.session_id=:'bsid' and ql.lo_id='10000000-0000-0000-0000-000000000003'), 'S1 plugin-ineligible LO excluded');
select public.t_assert((select (rejected_candidates->'ineligible_counts'->>'plugin_ineligible')::int from pie.decision_trace where session_id=:'bsid' order by created_at limit 1) = 4, 'S1 rejections traced');

\echo '### S2 content hierarchy (fresh learner B)'
select string_agg(primary_reasons->>'hierarchy', ',' order by created_at) as hs from pie.decision_trace where session_id=:'bsid' \gset
\echo :hs
-- eligible LOs: HF.DX (concept HF), HF.TX (concept HF). Fresh: pick1 unseen_concept, pick2 unseen_lo_within_seen_concept, then variants.
select public.t_assert(:'hs' = 'unseen_concept,unseen_lo_within_seen_concept,seen_lo_new_variant,seen_lo_new_variant,seen_lo_new_variant', 'S2 hierarchy order');
select public.t_assert((select bool_and(nble_type='new_content') from (select nble_type from pie.decision_trace where session_id=:'bsid' order by created_at limit 2) t), 'S2 NBLE new_content for unseen');

\echo '### S3 primary = weakness + unseen; argmax; trace fields complete'
select public.t_assert(bool_and(abs((primary_reasons->>'primary_score')::numeric - ((primary_reasons->>'weakness')::numeric + (primary_reasons->>'unseen_value')::numeric)) < 1e-5), 'S3 primary formula') from pie.decision_trace;
select public.t_assert(bool_and(total_score >= coalesce((select max((e->>'total')::numeric) from jsonb_array_elements(rejected_candidates->'top_eligible') e), -1e9)), 'S3 chosen is argmax') from pie.decision_trace;
select public.t_assert(bool_and(learner_id is not null and decision_id is not null and question_id is not null and event_type is not null
  and subject_id is not null and concept_id is not null and lo_id is not null and policy_version='pie-select/p3.0' and created_at is not null
  and jsonb_typeof(rejected_candidates->'top_eligible')='array'), 'S3 all directive fields') from pie.decision_trace;

\echo '### S4 secondary signals: all nine present with policy weights'
select public.t_assert(bool_and(secondary_reasons ?& array['uncertainty','misconception','behaviour','review_due','recency','difficulty','reasoning','coverage','information_value','anti_starvation']), 'S4 keys') from pie.decision_trace;
select public.t_assert(bool_and((secondary_reasons->'uncertainty'->>'weight')::numeric = 0.25 and (secondary_reasons->'reasoning'->>'weight')::numeric = 0), 'S4 weights from policy') from pie.decision_trace;

\echo '### S5 learner A with evidence: weakness drives choice; NBLE misconception/remediation'
-- A answers Q1 right, Q2 right, Q9 wrong C twice (LO3 re-enabled), Q3 wrong; completes.
update amc.amc_blueprint_lo set eligible = true where lo_id='10000000-0000-0000-0000-000000000003';
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select (public.create_practice_session('mcq','{}'::jsonb, array['22222222-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000009','22222222-0000-0000-0000-000000000010']::uuid[])).id as asid \gset
commit;
\set QA '22222222-0000-0000-0000-000000000001'
begin; select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated; select public.save_attempt('22222222-0000-0000-0000-000000000001', :'asid', 'A', false, 30, 5::smallint, 0, 3, '["A"]'::jsonb) \g /dev/null
commit;
begin; select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated; select public.save_attempt('22222222-0000-0000-0000-000000000002', :'asid', 'A', false, 30, 5::smallint, 0, 3, '["A"]'::jsonb) \g /dev/null
commit;
begin; select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated; select public.save_attempt('22222222-0000-0000-0000-000000000009', :'asid', 'C', true, 30, 5::smallint, 0, 3, '["C"]'::jsonb) \g /dev/null
commit;
begin; select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated; select public.save_attempt('22222222-0000-0000-0000-000000000010', :'asid', 'C', true, 30, 5::smallint, 0, 3, '["C"]'::jsonb) \g /dev/null
commit;
begin; select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated; select (public.complete_practice_session(:'asid')).status \g /dev/null
select public.refresh_my_lo_state() \g /dev/null
commit;
select lo_id, mastery, exposure_count, misconception_state from pie.learner_lo_state where user_id='aaaaaaaa-0000-0000-0000-00000000000a' order by lo_id;
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select session_id as a2, question_count from public.pie_create_session(3) \gset
commit;
select lo_id, nble_type, primary_reasons, total_score from pie.decision_trace where session_id=:'a2' order by created_at;
-- Hierarchy first: the only unseen LO (HF.TX) wins; then the weakest seen LO (AKI.DX, other concept)
-- beats the stronger seen LO (HF.DX) globally, typed misconception_repair (confident wrong).
select public.t_assert((select lo_id from pie.decision_trace where session_id=:'a2' order by created_at limit 1)='10000000-0000-0000-0000-000000000002', 'S5 unseen LO outranks seen-weak (hierarchy)');
select public.t_assert((select lo_id from pie.decision_trace where session_id=:'a2' order by created_at offset 1 limit 1)='10000000-0000-0000-0000-000000000003', 'S5 weakest seen LO next (global, cross-concept)');
select public.t_assert((select nble_type from pie.decision_trace where session_id=:'a2' order by created_at offset 1 limit 1)='misconception_repair', 'S5 NBLE misconception_repair');

\echo '### S6 prerequisite_repair'
insert into pie.lo_prerequisite(lo_id, prerequisite_lo_id) values ('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002');
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select session_id as a3 from public.pie_create_session(5) \gset
commit;
select lo_id, nble_type, primary_reasons->>'hierarchy' h from pie.decision_trace where session_id=:'a3' order by created_at;
select public.t_assert(exists (select 1 from pie.decision_trace where session_id=:'a3' and nble_type='prerequisite_repair' and lo_id='10000000-0000-0000-0000-000000000002'), 'S6 prerequisite_repair assigned');
delete from pie.lo_prerequisite;

\echo '### S7 anti-starvation'
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select session_id as a4 from public.pie_create_session(1) \gset
commit;
select (secondary_reasons->'anti_starvation'->>'value')::numeric as starv_before from pie.decision_trace where session_id=:'a4' \gset
-- age every trace of A by 8 days (superuser test-only: disable trigger)
alter table pie.decision_trace disable trigger decision_trace_append_only;
update pie.decision_trace set created_at = created_at - interval '8 days' where learner_id='aaaaaaaa-0000-0000-0000-00000000000a';
update pie.learner_lo_state set last_seen_at = last_seen_at - interval '8 days' where user_id='aaaaaaaa-0000-0000-0000-00000000000a';
alter table pie.decision_trace enable trigger decision_trace_append_only;
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select session_id as a5 from public.pie_create_session(1) \gset
commit;
select public.t_assert(:starv_before < 0.01 and (select (secondary_reasons->'anti_starvation'->>'value')::numeric from pie.decision_trace where session_id=:'a5') = 1, 'S7 starvation grows to cap after horizon');

\echo '### S8 next_question: ownership, exclusion, exhaustion'
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true);
  set local role authenticated;
  begin perform public.pie_next_question((select id from public.practice_sessions where user_id='aaaaaaaa-0000-0000-0000-00000000000a' and status='active' limit 1));
    raise exception 'FAIL S8 foreign session';
  exception when insufficient_privilege then null; end;
end $$;
begin;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select question_id as nq, question_position as np from public.pie_next_question(:'bsid') \gset
commit;
select public.t_assert(:np = 5 and (select count(*) from public.practice_session_questions where session_id=:'bsid' and question_id=:'nq') = 1, 'S8 appended, not duplicated');
-- 12 questions - retired - quarantined = 10 eligible; B has 6 -> 4 more then exhaustion
do $$ declare i int; s uuid; begin
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true);
  set local role authenticated;
  select id into s from public.practice_sessions where user_id='bbbbbbbb-0000-0000-0000-00000000000b' and session_type='pie_adaptive';
  for i in 1..4 loop perform public.pie_next_question(s); end loop;
  begin perform public.pie_next_question(s); raise exception 'FAIL S8 exhaustion';
  exception when no_data_found then null; end;
end $$;

\echo '### S9 no answer-key exposure / no internal access'
select public.t_assert(not exists (select 1 from pg_proc p, unnest(coalesce(p.proargnames,'{}')) a where p.proname in ('pie_create_session','pie_next_question') and a in ('correct_answer','explanation')), 'S9 no key columns in RPC output');
select public.t_assert(not exists (select 1 from pie.decision_trace where (primary_reasons::text || secondary_reasons::text || rejected_candidates::text) ~* 'correct_answer|explanation|is_correct'), 'S9 trace carries no key');
select public.t_assert(not has_table_privilege('authenticated','pie.decision_trace','select'), 'S9 trace internal');
select public.t_assert(not has_function_privilege('authenticated','pie.decide(uuid,uuid,text,integer,text,text)','execute'), 'S9 decide internal');
select public.t_assert(not has_function_privilege('anon','public.pie_create_session(integer,text)','execute'), 'S9 anon blocked');
do $$ begin
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}',true);
  set local role authenticated;
  begin perform public.pie_create_session(51); raise exception 'FAIL S9 bound'; exception when invalid_parameter_value then null; end;
end $$;

\echo '### S10 no fixed ratios / quotas in selector source'
select public.t_assert(not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='pie' and p.proname in ('rank_candidates','decide') and prosrc ~* 'ceil\(|quota|ratio|per_domain|slot'), 'S10 no ratio logic');

\echo '### S11 trace append-only; erasure clears traces'
do $$ begin
  begin update pie.decision_trace set total_score = 0; raise exception 'FAIL S11 update';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
begin;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}',true) \g /dev/null
set local role authenticated;
select public.erase_my_learning_data('ERASE_MY_LEARNING_DATA') as ec \gset
commit;
select public.t_assert(not exists (select 1 from pie.decision_trace where learner_id='aaaaaaaa-0000-0000-0000-00000000000a'), 'S11 A traces erased');
select public.t_assert(exists (select 1 from pie.decision_trace where learner_id='bbbbbbbb-0000-0000-0000-00000000000b'), 'S11 B traces kept');
\echo 'ALL P3 ASSERTIONS PASSED'
