-- Subject-cap tests for pie.decide (migration 0082). Run by run.sh against a throwaway cluster.
\set ON_ERROR_STOP on
create or replace function pg_temp.seed(p_subjects text[], p_sizes int[], p_tiers text[]) returns void language plpgsql as $$
declare s int; k int; v_s uuid; v_c uuid; v_lo uuid; v_q uuid;
begin
  truncate pie.decision_trace, public.practice_session_questions, public.practice_sessions, pie.question_lo, public.user_attempts, pie.learner_lo_state;
  delete from pie.learning_objective; delete from pie.concept; delete from public.questions; delete from public.subjects;
  for s in 1..array_length(p_subjects,1) loop
    insert into public.subjects(name,slug) values (p_subjects[s], p_subjects[s]) returning id into v_s;
    insert into pie.concept(concept_key,title) values ('C_'||p_subjects[s], p_subjects[s]) returning id into v_c;
    for k in 1..p_sizes[s] loop
      insert into pie.learning_objective(lo_key,concept_id,title) values (upper(p_subjects[s])||'_LO_'||k, v_c, 'lo') returning id into v_lo;
      insert into public.questions(zyntra_id,subject_id,stem,options,correct_answer,difficulty_tier)
        values (p_subjects[s]||'-'||k, v_s, 'stem', '["a","b","c","d","e"]', 'A', p_tiers[s]) returning id into v_q;
      insert into pie.question_lo values (v_q, v_lo, true, 1, 'import');
    end loop;
  end loop;
end $$;
create or replace function pg_temp.mix(p_session uuid) returns jsonb language sql as $$
  select coalesce(jsonb_object_agg(slug, n), '{}') from (select s.slug, count(*) n from public.practice_session_questions x
   join public.questions q on q.id=x.question_id join public.subjects s on s.id=q.subject_id where x.session_id=p_session group by 1) t $$;
create or replace function pg_temp.build(p_user uuid, p_n int, p_cfg jsonb default '{}') returns uuid language plpgsql as $$
declare v_sess uuid; d record; v_pos int := 0;
begin
  insert into public.practice_sessions(user_id,session_type,config) values (p_user,'pie_adaptive',p_cfg||'{"mode":"pie_adaptive"}') returning id into v_sess;
  for d in select * from pie.decide(p_user, v_sess, 'SESSION_BUILD', p_n) loop
    insert into public.practice_session_questions(session_id,question_id,position) values (v_sess,d.question_id,v_pos); v_pos := v_pos+1;
  end loop;
  return v_sess;
end $$;
create or replace function pg_temp.assert_ok(p_name text, p_ok boolean, p_detail jsonb) returns void language plpgsql as $$
begin raise notice '% % %', case when p_ok then 'PASS' else 'FAIL' end, p_name, p_detail; if not p_ok then raise exception 'test failed: %', p_name; end if; end $$;

-- T1: three subjects, subject "ph" would dominate uncapped (moderate tier = best difficulty fit). 20-item build -> cap 8.
select pg_temp.seed(array['ph','bs','xx'], array[40,40,40], array['moderate','easy','difficult']);
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-000000000001', 20); m jsonb := pg_temp.mix(v); begin
  perform pg_temp.assert_ok('T1 20-item build: no subject above 8', (select bool_and(value::int<=8) from jsonb_each_text(m)) and (select sum(value::int) from jsonb_each_text(m))=20, m);
  perform pg_temp.assert_ok('T1 trace has cap state and cap=8 with no fallback',
     (select bool_and((state_snapshot->'subject_cap'->>'cap')::int=8 and not (state_snapshot->'subject_cap'->>'fallback')::boolean) from pie.decision_trace where session_id=v)
     and (select count(*)=20 from pie.decision_trace where session_id=v), (select jsonb_agg(reason_codes) from pie.decision_trace where session_id=v));
  perform pg_temp.assert_ok('T1 exclusions recorded once ph hits cap',
     exists(select 1 from pie.decision_trace where session_id=v and 'subject_cap_applied'=any(reason_codes) and jsonb_array_length(state_snapshot->'subject_cap'->'excluded_candidates')>0
            and (state_snapshot->'subject_cap'->'excluded_candidates'->0->>'reason')='subject_cap'), '{}');
end $$;

-- T1b baseline: the live (uncapped) decide gives ph more than 8 of 20 on the same data
\i live_decide.sql
select pg_temp.seed(array['ph','bs','xx'], array[40,40,40], array['moderate','easy','difficult']);
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-000000000001', 20); m jsonb := pg_temp.mix(v); begin
  perform pg_temp.assert_ok('T1b live baseline exceeds the cap (shows the guard matters)', (m->>'ph')::int > 8, m);
end $$;
\i ../../migrations_v2/0082_pie_subject_session_cap.sql

-- T2: only one subject has items -> graceful fallback, all 20 served, fallback traced after the cap
select pg_temp.seed(array['ph'], array[40], array['moderate']);
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-000000000002', 20); m jsonb := pg_temp.mix(v); begin
  perform pg_temp.assert_ok('T2 single subject: 20 served via fallback', (m->>'ph')::int=20, m);
  perform pg_temp.assert_ok('T2 fallback recorded from item 9 on', (select count(*) from pie.decision_trace where session_id=v and 'subject_cap_fallback'=any(reason_codes)
        and state_snapshot->'subject_cap'->>'fallback_reason'='all_remaining_eligible_candidates_capped')=12, '{}');
end $$;

-- T3: small second subject runs out -> uncapped first, then fallback to capped subject
select pg_temp.seed(array['ph','bs'], array[40,5], array['moderate','easy']);
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-000000000003', 20); m jsonb := pg_temp.mix(v); begin
  perform pg_temp.assert_ok('T3 bs exhausted (5) before ph exceeds cap via fallback', (m->>'bs')::int=5 and (m->>'ph')::int=15, m);
  perform pg_temp.assert_ok('T3 no fallback while bs still had items',
     not exists(select 1 from pie.decision_trace t where t.session_id=v and 'subject_cap_fallback'=any(t.reason_codes)
                and (t.state_snapshot->'subject_cap'->>'served_before')::int < 13), '{}');
end $$;

-- T4: one-at-a-time NEXT_QUESTION with config target_length=10 -> cap 4; default target 20 -> cap 8
select pg_temp.seed(array['ph','bs','xx'], array[40,40,40], array['moderate','easy','difficult']);
do $$ declare v uuid; d record; k int; m jsonb; begin
  insert into public.practice_sessions(user_id,session_type,config) values ('00000000-0000-4000-8000-000000000004','pie_adaptive','{"mode":"pie_adaptive","target_length":10}') returning id into v;
  for k in 0..9 loop select * into d from pie.decide('00000000-0000-4000-8000-000000000004', v, 'NEXT_QUESTION', 1) limit 1;
    insert into public.practice_session_questions(session_id,question_id,position) values (v,d.question_id,k); end loop;
  m := pg_temp.mix(v);
  perform pg_temp.assert_ok('T4 target_length 10 -> no subject above 4', (select bool_and(value::int<=4) from jsonb_each_text(m)), m);
  perform pg_temp.assert_ok('T4 trace target_source=session_config', (select bool_and(state_snapshot->'subject_cap'->>'target_source'='session_config' and (state_snapshot->'subject_cap'->>'cap')::int=4) from pie.decision_trace where session_id=v), '{}');
  insert into public.practice_sessions(user_id,session_type,config) values ('00000000-0000-4000-8000-000000000005','pie_adaptive','{"mode":"pie_adaptive"}') returning id into v;
  for k in 0..19 loop select * into d from pie.decide('00000000-0000-4000-8000-000000000005', v, 'NEXT_QUESTION', 1) limit 1;
    insert into public.practice_session_questions(session_id,question_id,position) values (v,d.question_id,k); end loop;
  m := pg_temp.mix(v);
  perform pg_temp.assert_ok('T4b default target 20 (Nudge) -> no subject above 8', (select bool_and(value::int<=8) from jsonb_each_text(m)), m);
  perform pg_temp.assert_ok('T4b trace target_source=default_20', (select bool_and(state_snapshot->'subject_cap'->>'target_source'='default_20') from pie.decision_trace where session_id=v), '{}');
end $$;

-- T5: open-ended session past its target keeps scaling (25 served, target 20 -> cap ceil(0.4*25)=10)
select pg_temp.seed(array['ph','bs','xx'], array[40,40,40], array['moderate','easy','difficult']);
do $$ declare v uuid; d record; k int; m jsonb; begin
  insert into public.practice_sessions(user_id,session_type,config) values ('00000000-0000-4000-8000-000000000006','pie_adaptive','{"mode":"pie_adaptive"}') returning id into v;
  for k in 0..24 loop select * into d from pie.decide('00000000-0000-4000-8000-000000000006', v, 'NEXT_QUESTION', 1) limit 1;
    insert into public.practice_session_questions(session_id,question_id,position) values (v,d.question_id,k); end loop;
  m := pg_temp.mix(v);
  perform pg_temp.assert_ok('T5 25 items: no subject above ceil(0.4*25)=10', (select bool_and(value::int<=10) from jsonb_each_text(m)), m);
end $$;

-- T6: security posture kept: definer, search_path '', no anon/authenticated/public execute
do $$ begin
  perform pg_temp.assert_ok('T6 SECURITY DEFINER + search_path=""', (select prosecdef and proconfig=array['search_path=""'] from pg_proc where oid='pie.decide(uuid,uuid,text,integer,text,text)'::regprocedure), '{}');
  perform pg_temp.assert_ok('T6 EXECUTE: service_role yes; anon, authenticated, public no',
     has_function_privilege('service_role','pie.decide(uuid,uuid,text,integer,text,text)','execute')
     and not has_function_privilege('anon','pie.decide(uuid,uuid,text,integer,text,text)','execute')
     and not has_function_privilege('authenticated','pie.decide(uuid,uuid,text,integer,text,text)','execute'), '{}');
end $$;

-- T7: deterministic: same data, same session id order -> same picks
select pg_temp.seed(array['ph','bs','xx'], array[40,40,40], array['moderate','easy','difficult']);
do $$ declare a uuid := pg_temp.build('00000000-0000-4000-8000-000000000007', 20); b uuid := pg_temp.build('00000000-0000-4000-8000-000000000007', 20); begin
  perform pg_temp.assert_ok('T7 two sessions both respect cap', (select bool_and(value::int<=8) from jsonb_each_text(pg_temp.mix(a))) and (select bool_and(value::int<=8) from jsonb_each_text(pg_temp.mix(b))), pg_temp.mix(b));
end $$;
select 'ALL TESTS PASSED';
