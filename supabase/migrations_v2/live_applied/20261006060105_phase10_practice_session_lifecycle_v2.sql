create or replace function public.create_practice_session(p_session_type text,p_config jsonb,p_question_ids uuid[])
returns public.practice_sessions language plpgsql security definer set search_path=public,pg_temp as $$
declare v_session public.practice_sessions; v_user uuid:=auth.uid(); v_question_id uuid; v_position integer:=0;
begin
if v_user is null then raise exception 'authentication required'; end if;
if coalesce(trim(p_session_type),'')='' then raise exception 'session_type is required'; end if;
if p_question_ids is null or coalesce(array_length(p_question_ids,1),0)=0 then raise exception 'at least one question is required'; end if;
if exists(select 1 from unnest(p_question_ids) q(id) left join public.questions qn on qn.id=q.id where qn.id is null) then raise exception 'one or more questions do not exist'; end if;
insert into public.practice_sessions(user_id,session_type,status,config,started_at,last_activity_at)
values(v_user,p_session_type,'active',coalesce(p_config,'{}'::jsonb),now(),now()) returning * into v_session;
foreach v_question_id in array p_question_ids loop
insert into public.practice_session_questions(session_id,question_id,position,presented_at) values(v_session.id,v_question_id,v_position,now());
v_position:=v_position+1;
end loop;
return v_session;
end $$;
revoke all on function public.create_practice_session(text,jsonb,uuid[]) from public;
grant execute on function public.create_practice_session(text,jsonb,uuid[]) to authenticated;

create or replace function public.get_practice_session_questions(p_session_id uuid)
returns table(session_question_id uuid,session_id uuid,question_id uuid,question_position integer,presented_at timestamptz,answered_at timestamptz,zyntra_id text,stem text,options jsonb,explanation text,subject_id uuid,subtopic_id uuid,difficulty_tier text,version integer)
language sql security definer set search_path=public,pg_temp as $$
select psq.id,psq.session_id,psq.question_id,psq.position,psq.presented_at,psq.answered_at,q.zyntra_id,q.stem,q.options,q.explanation,q.subject_id,q.subtopic_id,q.difficulty_tier,q.version
from public.practice_session_questions psq join public.practice_sessions ps on ps.id=psq.session_id join public.questions q on q.id=psq.question_id
where ps.id=p_session_id and ps.user_id=auth.uid() order by psq.position
$$;
revoke all on function public.get_practice_session_questions(uuid) from public;
grant execute on function public.get_practice_session_questions(uuid) to authenticated;

create or replace function public.resume_practice_session(p_session_id uuid)
returns public.practice_sessions language plpgsql security definer set search_path=public,pg_temp as $$
declare v_session public.practice_sessions;
begin
if auth.uid() is null then raise exception 'authentication required'; end if;
select * into v_session from public.practice_sessions where id=p_session_id and user_id=auth.uid();
if not found then raise exception 'practice session not found'; end if;
if v_session.status='completed' then raise exception 'practice session is already completed'; end if;
update public.practice_sessions set status='active',last_activity_at=now(),updated_at=now() where id=p_session_id and user_id=auth.uid() returning * into v_session;
return v_session;
end $$;
revoke all on function public.resume_practice_session(uuid) from public;
grant execute on function public.resume_practice_session(uuid) to authenticated;

create or replace function public.complete_practice_session(p_session_id uuid)
returns public.practice_sessions language plpgsql security definer set search_path=public,pg_temp as $$
declare v_session public.practice_sessions;
begin
if auth.uid() is null then raise exception 'authentication required'; end if;
update public.practice_sessions set status='completed',completed_at=coalesce(completed_at,now()),last_activity_at=now(),updated_at=now()
where id=p_session_id and user_id=auth.uid() and status<>'completed' returning * into v_session;
if not found then select * into v_session from public.practice_sessions where id=p_session_id and user_id=auth.uid(); if not found then raise exception 'practice session not found'; end if; end if;
return v_session;
end $$;
revoke all on function public.complete_practice_session(uuid) from public;
grant execute on function public.complete_practice_session(uuid) to authenticated;

create or replace function public.save_attempt(p_question_id uuid,p_session_id uuid,p_selected_answer text,p_is_correct boolean,p_time_taken_seconds integer default null,p_confidence_level smallint default null,p_answer_changes_count integer default 0,p_time_to_first_click integer default null,p_change_sequence jsonb default null,p_pause_events jsonb default null,p_time_of_day text default null,p_question_position integer default null,p_previous_question_correct boolean default null,p_question_version integer default null,p_app_version text default null,p_provenance jsonb default '{}'::jsonb)
returns public.user_attempts language plpgsql security definer set search_path=public,pg_temp as $$
declare v_attempt public.user_attempts; v_user uuid:=auth.uid(); v_correct_answer text; v_is_correct boolean;
begin
if v_user is null then raise exception 'authentication required'; end if;
if p_confidence_level is not null and p_confidence_level not between 1 and 5 then raise exception 'confidence_level must be between 1 and 5'; end if;
if p_session_id is not null and not exists(select 1 from public.practice_session_questions psq join public.practice_sessions ps on ps.id=psq.session_id where psq.session_id=p_session_id and psq.question_id=p_question_id and ps.user_id=v_user) then raise exception 'question is not part of the authenticated practice session'; end if;
select q.correct_answer into v_correct_answer from public.questions q where q.id=p_question_id;
if not found then raise exception 'question not found'; end if;
v_is_correct:=upper(trim(coalesce(p_selected_answer,'')))=upper(trim(coalesce(v_correct_answer,'')));
insert into public.user_attempts(user_id,question_id,session_id,selected_answer,is_correct,time_taken_seconds,confidence_level,answer_changes_count,time_to_first_click,change_sequence,pause_events,time_of_day,question_position,previous_question_correct,question_version,app_version,provenance)
values(v_user,p_question_id,p_session_id,p_selected_answer,v_is_correct,p_time_taken_seconds,p_confidence_level,p_answer_changes_count,p_time_to_first_click,p_change_sequence,p_pause_events,p_time_of_day,p_question_position,p_previous_question_correct,p_question_version,p_app_version,coalesce(p_provenance,'{}'::jsonb)) returning * into v_attempt;
update public.practice_session_questions set answered_at=now() where session_id=p_session_id and question_id=p_question_id;
update public.practice_sessions set last_activity_at=now(),updated_at=now() where id=p_session_id and user_id=v_user;
return v_attempt;
end $$;
revoke all on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) from public;
grant execute on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) to authenticated;