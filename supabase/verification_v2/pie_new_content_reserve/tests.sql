-- New-content reservation tests for pie.decide (migration 0084). Run by run.sh.
\set ON_ERROR_STOP on
\i ../pie_subject_cap/tests.sql_helpers.sql
-- "experienced" learner: has failed every bs LO (mastery 0, seen 2 days ago, decided 2 days ago) -> bs outranks unseen ph
create or replace function pg_temp.experience(p_user uuid, p_slugs text[]) returns void language plpgsql as $$
begin
  insert into pie.learner_lo_state(user_id,lo_id,exposure_count,mastery,uncertainty,last_seen_at)
  select p_user, ql.lo_id, 2, 0, 0.1, now() - interval '2 days' from pie.question_lo ql join public.questions q on q.id=ql.question_id
   join public.subjects s on s.id=q.subject_id where s.slug = any(p_slugs);
  insert into pie.decision_trace(user_id,decision_type,selected_action,policy_version,created_at)
  select p_user,'SESSION_BUILD',jsonb_build_object('lo_id',lo_id),'pie-select/p3.0',now()-interval '2 days' from pie.learner_lo_state where user_id=p_user;
end $$;
create or replace function pg_temp.positions(p_session uuid, p_slug text) returns int[] language sql as $$
  select coalesce(array_agg(x.position order by x.position), '{}') from public.practice_session_questions x
   join public.questions q on q.id=x.question_id join public.subjects s on s.id=q.subject_id where x.session_id=p_session and s.slug=p_slug $$;

-- R1: experienced learner, 4 seen bs subjects x 10 + unseen ph 40 -> 20-item build gives >= 4 ph, spread, cap held
select pg_temp.seed(array['ph','b1','b2','b3','b4'], array[40,10,10,10,10], array['moderate','moderate','moderate','moderate','moderate']);
select pg_temp.experience('00000000-0000-4000-8000-0000000000e1', array['b1','b2','b3','b4']);
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-0000000000e1', 20); m jsonb := pg_temp.mix(v); begin
  perform pg_temp.assert_ok('R1 experienced learner: >= 4 ph of 20', coalesce((m->>'ph')::int,0) >= 4, m);
  perform pg_temp.assert_ok('R1 still 20 items, no subject above 8', (select sum(value::int)=20 and bool_and(value::int<=8) from jsonb_each_text(m)), m);
  perform pg_temp.assert_ok('R1 reserved picks spread (positions 0,5,10,15)', pg_temp.positions(v,'ph') = array[0,5,10,15], to_jsonb(pg_temp.positions(v,'ph')));
  perform pg_temp.assert_ok('R1 exactly 4 new picks traced (selected_is_new); forced ones carry new_content_reserved + displaced candidate',
    (select count(*)=4 from pie.decision_trace where session_id=v and (state_snapshot->'new_content_reserve'->>'selected_is_new')::boolean)
    and (select count(*)>=1 and bool_and(state_snapshot->'new_content_reserve'->'displaced_candidate' is not null and (state_snapshot->'new_content_reserve'->>'forced')::boolean)
       from pie.decision_trace where session_id=v and 'new_content_reserved'=any(reason_codes)), '{}');
  perform pg_temp.assert_ok('R1 every trace carries new_content_reserve state (reserve=4, interval=5)',
    (select bool_and((state_snapshot->'new_content_reserve'->>'reserve')::int=4 and (state_snapshot->'new_content_reserve'->>'interval')::int=5) from pie.decision_trace where session_id=v), '{}');
  perform pg_temp.assert_ok('R1 no repeats', (select count(distinct question_id)=20 from public.practice_session_questions where session_id=v), '{}');
end $$;

-- R1b: the 0083 decide (no reservation) gives this learner no ph -> shows the reservation matters
\i ../pie_subject_cap/live_decide.sql
\i ../../migrations_v2/0083_pie_subject_session_cap.sql
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-0000000000e1', 20); m jsonb := pg_temp.mix(v); begin
  perform pg_temp.assert_ok('R1b 0083 baseline: < 4 ph for the experienced learner', coalesce((m->>'ph')::int,0) < 4, m);
end $$;
\i ../../migrations_v2/0084_pie_new_content_reserve.sql

-- R2: brand-new learner: everything is new -> nothing forced, cap still holds (ph <= 8)
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-0000000000e2', 20); m jsonb := pg_temp.mix(v); begin
  perform pg_temp.assert_ok('R2 new learner: no subject above 8, 20 items', (select sum(value::int)=20 and bool_and(value::int<=8) from jsonb_each_text(m)), m);
  perform pg_temp.assert_ok('R2 new learner: no forced picks', not exists(select 1 from pie.decision_trace where session_id=v and 'new_content_reserved'=any(reason_codes)), '{}');
end $$;

-- R3: target 10 via config -> reserve 2, interval 5
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-0000000000e1', 10, '{"target_length":10}'); m jsonb := pg_temp.mix(v); begin
  perform pg_temp.assert_ok('R3 target 10: >= 2 ph and no subject above 4', coalesce((m->>'ph')::int,0) >= 2 and (select bool_and(value::int<=4) from jsonb_each_text(m)), m);
end $$;

-- R4: one-at-a-time NEXT_QUESTION decisions count earlier new picks from the session trace (no over-reserving)
do $$ declare v uuid; d record; k int; m jsonb; begin
  insert into public.practice_sessions(user_id,session_type,config) values ('00000000-0000-4000-8000-0000000000e3','pie_adaptive','{"target_length":20}') returning id into v;
  perform pg_temp.experience('00000000-0000-4000-8000-0000000000e3', array['b1','b2','b3','b4']);
  for k in 0..19 loop
    select * into d from pie.decide('00000000-0000-4000-8000-0000000000e3', v, 'NEXT_QUESTION', 1);
    insert into public.practice_session_questions(session_id,question_id,position) values (v,d.question_id,k);
  end loop;
  m := pg_temp.mix(v);
  perform pg_temp.assert_ok('R4 one-at-a-time: >= 4 ph, exactly 4 new picks (not over-reserved), no subject above 8',
    coalesce((m->>'ph')::int,0) >= 4 and (select bool_and(value::int<=8) from jsonb_each_text(m))
    and (select count(*)=4 from pie.decision_trace where session_id=v and (state_snapshot->'new_content_reserve'->>'selected_is_new')::boolean)
    and (select count(*) between 1 and 4 from pie.decision_trace where session_id=v and 'new_content_reserved'=any(reason_codes)), m);
end $$;

-- R5: no new content left -> nothing forced, reason recorded
select pg_temp.seed(array['b1','b2','b3'], array[10,10,10], array['moderate','moderate','moderate']);
select pg_temp.experience('00000000-0000-4000-8000-0000000000e4', array['b1','b2','b3']);
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-0000000000e4', 20); begin
  perform pg_temp.assert_ok('R5 no new content: 20 served, none forced, reason no_new_content_eligible',
    (select count(*)=20 from public.practice_session_questions where session_id=v)
    and not exists(select 1 from pie.decision_trace where session_id=v and 'new_content_reserved'=any(reason_codes))
    and exists(select 1 from pie.decision_trace where session_id=v and state_snapshot->'new_content_reserve'->>'reason'='no_new_content_eligible'), '{}');
end $$;

-- R6: answer lock unchanged: pie_next_question refuses while an item is unanswered
do $$ declare v uuid := pg_temp.build('00000000-0000-4000-8000-0000000000e4', 1); ok boolean := false; begin
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000e4","role":"authenticated"}', true);
  begin perform public.pie_next_question(v); exception when sqlstate '55000' then ok := true; end;
  perform pg_temp.assert_ok('R6 answer lock: PIE_UNANSWERED (55000) still raised', ok, '{}');
end $$;

-- R7: security posture unchanged
do $$ begin
  perform pg_temp.assert_ok('R7 decide SECURITY DEFINER + search_path=""', (select prosecdef and proconfig=array['search_path=""'] from pg_proc where oid='pie.decide(uuid,uuid,text,integer,text,text)'::regprocedure), '{}');
  perform pg_temp.assert_ok('R7 decide EXECUTE: service_role only (no anon/authenticated/public)',
    has_function_privilege('service_role','pie.decide(uuid,uuid,text,integer,text,text)','execute')
    and not has_function_privilege('anon','pie.decide(uuid,uuid,text,integer,text,text)','execute')
    and not has_function_privilege('authenticated','pie.decide(uuid,uuid,text,integer,text,text)','execute'), '{}');
end $$;
