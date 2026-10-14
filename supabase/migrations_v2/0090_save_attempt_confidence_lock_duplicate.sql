-- Applied 2026-10-14 with owner approval. Rollback: backup_save_attempt_before_enforcement.sql
CREATE OR REPLACE FUNCTION public.save_attempt(p_question_id uuid, p_session_id uuid, p_selected_answer text, p_is_correct boolean, p_time_taken_seconds integer DEFAULT NULL::integer, p_confidence_level smallint DEFAULT NULL::smallint, p_answer_changes_count integer DEFAULT 0, p_time_to_first_click integer DEFAULT NULL::integer, p_change_sequence jsonb DEFAULT NULL::jsonb, p_pause_events jsonb DEFAULT NULL::jsonb, p_time_of_day text DEFAULT NULL::text, p_question_position integer DEFAULT NULL::integer, p_previous_question_correct boolean DEFAULT NULL::boolean, p_question_version integer DEFAULT NULL::integer, p_app_version text DEFAULT NULL::text, p_provenance jsonb DEFAULT '{}'::jsonb)
 RETURNS user_attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_attempt public.user_attempts; v_user uuid:=auth.uid(); v_correct_answer text; v_is_correct boolean; v_answer_changes integer;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_confidence_level is not null and p_confidence_level not between 1 and 5 then raise exception 'confidence_level must be between 1 and 5'; end if;
 select q.correct_answer into v_correct_answer from public.questions q where q.id=p_question_id and q.status='active';
 if not found then raise exception 'question not found or inactive'; end if;
 if p_session_id is not null and not exists(select 1 from public.practice_session_questions psq join public.practice_sessions ps on ps.id=psq.session_id where psq.session_id=p_session_id and psq.question_id=p_question_id and ps.user_id=v_user and ps.status='active') then raise exception 'question is not part of an active authenticated practice session'; end if;
 if p_confidence_level is null then raise exception 'confidence_required' using errcode='22023'; end if;
 if p_session_id is not null then
   if exists(select 1 from public.practice_sessions ps where ps.id=p_session_id and ps.config->>'answer_change_mode'='locked')
      and jsonb_typeof(coalesce(p_change_sequence,'[]'::jsonb))='array' and jsonb_array_length(coalesce(p_change_sequence,'[]'::jsonb))>1
   then raise exception 'answer_locked' using errcode='22023'; end if;
   if exists(select 1 from public.user_attempts ua where ua.session_id=p_session_id and ua.question_id=p_question_id and ua.user_id=v_user)
   then raise exception 'attempt_already_submitted' using errcode='23505'; end if;
 end if;

 v_is_correct:=upper(trim(coalesce(p_selected_answer,'')))=upper(trim(coalesce(v_correct_answer,'')));
 v_answer_changes:=greatest(0,coalesce(jsonb_array_length(case when jsonb_typeof(coalesce(p_change_sequence,'[]'::jsonb))='array' then coalesce(p_change_sequence,'[]'::jsonb) else '[]'::jsonb end),0)-1);

 insert into public.user_attempts(user_id,question_id,session_id,selected_answer,is_correct,time_taken_seconds,confidence_level,answer_changes_count,time_to_first_click,change_sequence,pause_events,time_of_day,question_position,previous_question_correct,question_version,app_version,provenance)
 values(v_user,p_question_id,p_session_id,p_selected_answer,v_is_correct,p_time_taken_seconds,p_confidence_level,v_answer_changes,p_time_to_first_click,p_change_sequence,p_pause_events,p_time_of_day,p_question_position,p_previous_question_correct,p_question_version,p_app_version,coalesce(p_provenance,'{}'::jsonb))
 returning * into v_attempt;

 update public.practice_session_questions set answered_at=now() where session_id=p_session_id and question_id=p_question_id;
 update public.practice_sessions set last_activity_at=now(),updated_at=now() where id=p_session_id and user_id=v_user;

 begin
   insert into intelligence.behavior_events(user_id,session_id,question_id,event_type,event_version,occurred_at,sequence_no,question_position,payload)
   values(v_user,p_session_id,p_question_id,'MCQ_ATTEMPT',1,now(),p_question_position,p_question_position,jsonb_build_object('is_correct',v_is_correct,'selected_answer',p_selected_answer,'correct_answer',v_correct_answer,'time_taken_seconds',p_time_taken_seconds,'confidence_level',p_confidence_level,'answer_changes_count',v_answer_changes,'time_to_first_click',p_time_to_first_click,'change_sequence',coalesce(p_change_sequence,'[]'::jsonb),'pause_events',coalesce(p_pause_events,'[]'::jsonb)));
 exception when others then raise warning 'save_attempt: behavior_event not recorded for attempt % (SQLSTATE %): %',v_attempt.id,sqlstate,sqlerrm; end;

 begin
   insert into pie.pie_observation(user_id,question_id,attempt_id,observation_type,observed_at,payload,provenance)
   values(v_user,p_question_id,v_attempt.id,'MCQ_ATTEMPT',now(),jsonb_build_object('outcome',case when v_is_correct then 'CORRECT' else 'INCORRECT' end,'selected_answer',p_selected_answer,'correct_answer',v_correct_answer,'is_correct',v_is_correct,'confidence_level',p_confidence_level,'confidence_normalized',case when p_confidence_level is null then null else (p_confidence_level-1)/4.0 end,'time_total_ms',case when p_time_taken_seconds is null then null else p_time_taken_seconds*1000 end,'time_taken_seconds',p_time_taken_seconds,'time_to_first_click',p_time_to_first_click,'answer_changes',v_answer_changes,'change_sequence',coalesce(p_change_sequence,'[]'::jsonb),'pause_events',coalesce(p_pause_events,'[]'::jsonb),'first_answer_correct',null,'final_answer_correct',v_is_correct,'question_position',p_question_position),jsonb_build_object('source','public.save_attempt','question_version',p_question_version,'session_id',p_session_id,'attempt_id',v_attempt.id,'answer_capture_version','3'));
 exception when others then raise warning 'save_attempt: PIE observation not recorded for attempt % (SQLSTATE %): %',v_attempt.id,sqlstate,sqlerrm; end;

 begin perform pie.rebuild_lo_state(v_user); exception when others then raise warning 'save_attempt: LO state rebuild failed for attempt % (SQLSTATE %): %',v_attempt.id,sqlstate,sqlerrm; end;
 begin perform pie.rebuild_misconception_state(v_user); exception when others then raise warning 'save_attempt: misconception state rebuild failed for attempt % (SQLSTATE %): %',v_attempt.id,sqlstate,sqlerrm; end;
 begin
   perform pie.rebuild_authoritative_inference(v_user);
   perform pie.rebuild_policy_shadow(v_user);
 exception when others then
   raise warning 'save_attempt: authoritative inference/policy rebuild failed for attempt % (SQLSTATE %): %',v_attempt.id,sqlstate,sqlerrm;
 end;
 return v_attempt;
end
$function$

;
