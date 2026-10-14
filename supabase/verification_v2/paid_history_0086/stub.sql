do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema auth; create schema pie;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
create table public.profiles(id uuid primary key);
create table public.subjects(id uuid primary key, name text, is_active boolean default true);
create table public.subtopics(id uuid primary key, subject_id uuid, name text);
create table public.questions(id uuid primary key, zyntra_id text, subject_id uuid, subtopic_id uuid, stem text, options jsonb,
  correct_answer text, explanation text, difficulty_tier text, status text default 'active', version int default 1);
grant select on public.questions to anon, authenticated;
create view public.questions_for_learner as select id, stem from public.questions; grant select on public.questions_for_learner to authenticated;
create table pie.concept(id uuid primary key, title text);
create table pie.learning_objective(id uuid primary key, concept_id uuid, title text);
create table pie.question_lo(question_id uuid, lo_id uuid, is_primary boolean);
create table public.payments(user_id uuid, tier text, trial_end_at timestamptz, current_period_end timestamptz, cancel_at_period_end boolean);
create table public.practice_sessions(id uuid primary key default gen_random_uuid(), user_id uuid, session_type text, status text default 'active',
  config jsonb default '{}', started_at timestamptz, completed_at timestamptz, created_at timestamptz default now());
create table public.practice_session_questions(id uuid primary key default gen_random_uuid(), session_id uuid, question_id uuid, position int,
  presented_at timestamptz, answered_at timestamptz);
create table public.user_attempts(id uuid primary key default gen_random_uuid(), user_id uuid, question_id uuid, session_id uuid,
  selected_answer text not null, is_correct boolean not null, time_taken_seconds int, confidence_level smallint, answer_changes_count int default 0,
  time_to_first_click int, change_sequence jsonb, question_position int, created_at timestamptz default now());
-- PR #87 paid check stand-ins (paid = any payments row with tier not null)
create function public.payment_row_entitled(p public.payments) returns boolean language sql stable as $$ select p.tier is not null $$;
create function public.current_user_can_read_questions() returns boolean language sql stable security definer set search_path='' as
  $$ select exists(select 1 from public.payments p where p.user_id = auth.uid() and public.payment_row_entitled(p)) $$;
revoke all on function public.current_user_can_read_questions() from public, anon; grant execute on function public.current_user_can_read_questions() to authenticated;
-- practice RPC stand-ins with live signatures
create function public.pie_create_session(p_count integer default 10, p_blueprint_key text default 'AMC_CAT_MCQ'::text, p_mode text default 'pie_adaptive'::text)
 returns table(session_id uuid, question_count integer) language sql security definer set search_path='' as
 $$ insert into public.practice_sessions(user_id, session_type) values (auth.uid(), p_mode) returning id, p_count $$;
create function public.pie_next_question(p_session_id uuid) returns table(question_id uuid, question_position integer, nble_type text, decision_id uuid)
 language sql security definer set search_path='' as $$ select null::uuid, 0, null::text, null::uuid $$;
create function public.get_practice_session_questions(p_session_id uuid) returns table(session_question_id uuid, session_id uuid, question_id uuid, question_position integer,
  presented_at timestamp with time zone, answered_at timestamp with time zone, zyntra_id text, stem text, options jsonb, explanation text, subject_id uuid, subtopic_id uuid, difficulty_tier text, version integer)
 language sql security definer set search_path='' as $$ select psq.id, psq.session_id, q.id, psq.position, psq.presented_at, psq.answered_at, q.zyntra_id, q.stem, q.options, null::text, q.subject_id, q.subtopic_id, q.difficulty_tier, q.version
   from public.practice_session_questions psq join public.questions q on q.id=psq.question_id where psq.session_id=p_session_id $$;
create function public.get_practice_session_results(p_session_id uuid) returns table(session_question_id uuid, session_id uuid, question_id uuid, question_position integer,
  zyntra_id text, stem text, options jsonb, correct_answer text, explanation text, subject_id uuid, subtopic_id uuid, difficulty_tier text, version integer,
  selected_answer text, is_correct boolean, confidence_level smallint, time_taken_seconds integer, answer_changes_count integer)
 language sql security definer set search_path='' as $$ select psq.id, psq.session_id, q.id, psq.position, q.zyntra_id, q.stem, q.options, q.correct_answer, q.explanation, q.subject_id, q.subtopic_id, q.difficulty_tier, q.version,
   ua.selected_answer, ua.is_correct, ua.confidence_level, ua.time_taken_seconds, ua.answer_changes_count
   from public.practice_session_questions psq join public.questions q on q.id=psq.question_id left join public.user_attempts ua on ua.session_id=psq.session_id and ua.question_id=psq.question_id where psq.session_id=p_session_id $$;
create function public.get_my_attempt_history(p_limit integer default 1000, p_before timestamptz default null, p_before_attempt_id uuid default null) returns setof public.user_attempts language sql security definer set search_path='' as $$ select * from public.user_attempts where user_id=auth.uid() $$;
create function public.get_practice_question_pool(integer) returns setof uuid language sql as $$ select id from public.questions $$;
create function public.create_practice_session(text, jsonb, uuid[]) returns uuid language sql as $$ select null::uuid $$;
grant execute on all functions in schema public to authenticated;
-- seed: paid user P, unpaid user U
insert into public.profiles values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b');
insert into public.payments values ('00000000-0000-0000-0000-00000000000a','lifetime',null,null,false);
insert into public.subjects values ('10000000-0000-0000-0000-000000000001','Cardiology',true);
insert into public.subtopics values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Heart failure');
insert into public.questions(id,zyntra_id,subject_id,subtopic_id,stem,options,correct_answer,explanation,difficulty_tier) values
 ('30000000-0000-0000-0000-000000000001','ZQ-1','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Stem1','["a","b"]','A','Expl1','moderate'),
 ('30000000-0000-0000-0000-000000000002','ZQ-2','10000000-0000-0000-0000-000000000001',null,'Stem2','["a","b"]','B','Expl2','easy');
insert into public.practice_sessions(id,user_id,session_type,status,completed_at) values
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','pie_adaptive','completed',now()),
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','mcq','completed',now()),
 ('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000000b','pie_adaptive','completed',now());
insert into public.practice_session_questions(session_id,question_id,position) values
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',0),('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',1),
 ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001',0);
insert into public.user_attempts(user_id,question_id,session_id,selected_answer,is_correct,answer_changes_count,change_sequence,time_to_first_click) values
 ('00000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','B',false,1,'["A","B"]',3),
 ('00000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','B',true,0,null,5),
 ('00000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','A',false,0,null,5),
 ('00000000-0000-0000-0000-00000000000b','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003','A',true,0,null,1);
