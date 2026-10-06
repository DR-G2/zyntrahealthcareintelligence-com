create or replace function public.save_attempt(
 p_question_id uuid,p_session_id uuid,p_selected_answer text,p_is_correct boolean,
 p_time_taken_seconds integer default null,p_confidence_level smallint default null,
 p_answer_changes_count integer default 0,p_time_to_first_click integer default null,
 p_change_sequence jsonb default null,p_pause_events jsonb default null,p_time_of_day text default null,
 p_question_position integer default null,p_previous_question_correct boolean default null,
 p_question_version integer default null,p_app_version text default null,p_provenance jsonb default '{}'::jsonb
) returns public.user_attempts
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_attempt public.user_attempts; v_user uuid:=auth.uid(); v_correct_answer text; v_is_correct boolean;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_confidence_level is not null and p_confidence_level not between 1 and 5 then raise exception 'confidence_level must be between 1 and 5'; end if;
 if p_session_id is not null and not exists(
   select 1 from public.practice_session_questions psq join public.practice_sessions ps on ps.id=psq.session_id
   where psq.session_id=p_session_id and psq.question_id=p_question_id and ps.user_id=v_user
 ) then raise exception 'question is not part of the authenticated practice session'; end if;
 select q.correct_answer into v_correct_answer from public.questions q where q.id=p_question_id;
 if not found then raise exception 'question not found'; end if;
 v_is_correct:=upper(trim(coalesce(p_selected_answer,'')))=upper(trim(coalesce(v_correct_answer,'')));
 insert into public.user_attempts(user_id,question_id,session_id,selected_answer,is_correct,time_taken_seconds,confidence_level,answer_changes_count,time_to_first_click,change_sequence,pause_events,time_of_day,question_position,previous_question_correct,question_version,app_version,provenance)
 values(v_user,p_question_id,p_session_id,p_selected_answer,v_is_correct,p_time_taken_seconds,p_confidence_level,p_answer_changes_count,p_time_to_first_click,p_change_sequence,p_pause_events,p_time_of_day,p_question_position,p_previous_question_correct,p_question_version,p_app_version,coalesce(p_provenance,'{}'::jsonb))
 returning * into v_attempt;
 update public.practice_session_questions set answered_at=now() where session_id=p_session_id and question_id=p_question_id;
 update public.practice_sessions set last_activity_at=now(),updated_at=now() where id=p_session_id and user_id=v_user;

 -- Intelligence/PIE is deliberately best-effort and cannot invalidate answer persistence.
 begin
   insert into intelligence.behavior_events(user_id,session_id,question_id,event_type,event_version,occurred_at,sequence_no,question_position,payload)
   values(v_user,p_session_id,p_question_id,'MCQ_ATTEMPT',1,now(),p_question_position,p_question_position,
     jsonb_build_object('is_correct',v_is_correct,'time_taken_seconds',p_time_taken_seconds,'confidence_level',p_confidence_level,'answer_changes_count',p_answer_changes_count));
 exception when others then null;
 end;

 begin
   insert into pie.pie_observation(user_id,question_id,attempt_id,observation_type,observed_at,payload,provenance)
   values(v_user,p_question_id,v_attempt.id,'MCQ_ATTEMPT',now(),
     jsonb_build_object(
       'outcome',case when v_is_correct then 'CORRECT' else 'INCORRECT' end,
       'confidence_normalized',case when p_confidence_level is null then null else (p_confidence_level-1)/4.0 end,
       'time_total_ms',case when p_time_taken_seconds is null then null else p_time_taken_seconds*1000 end,
       'answer_changes',coalesce(p_answer_changes_count,0),
       'first_answer_correct',null,
       'final_answer_correct',v_is_correct
     ),
     jsonb_build_object('source','public.save_attempt','question_version',p_question_version));
 exception when others then null;
 end;

 return v_attempt;
end $$;