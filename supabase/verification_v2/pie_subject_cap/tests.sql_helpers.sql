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
