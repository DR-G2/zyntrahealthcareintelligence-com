CREATE OR REPLACE FUNCTION public.pie_next_question(p_session_id uuid)
 RETURNS TABLE(question_id uuid, question_position integer, nble_type text, decision_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid(); v_pos integer; d record; v_cfg jsonb;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select config into v_cfg from public.practice_sessions where id=p_session_id and user_id=v_uid and status='active' for update;
 if not found then raise exception 'active session not found' using errcode='42501'; end if;
 if coalesce(v_cfg->>'mode','pie_adaptive')<>'pie_adaptive' then raise exception 'not an adaptive session' using errcode='42501'; end if;
 if exists(select 1 from public.practice_session_questions where session_id=p_session_id and answered_at is null) then raise exception 'PIE_UNANSWERED: answer the served question before requesting another' using errcode='55000'; end if;
 select coalesce(max(position)+1,0) into v_pos from public.practice_session_questions where session_id=p_session_id;
 if v_pos>=1000 then raise exception 'practice session cannot contain more than 1000 questions' using errcode='54000'; end if;
 select * into d from pie.decide(v_uid,p_session_id,'NEXT_QUESTION',1,'pie-select/p3.0',coalesce(v_cfg->>'blueprint_key','AMC_CAT_MCQ')) limit 1;
 if d.question_id is null then raise exception 'PIE_NO_ELIGIBLE_CANDIDATE: selector returned no question' using errcode='P0002'; end if;
 insert into public.practice_session_questions(session_id,question_id,position,presented_at) values(p_session_id,d.question_id,v_pos,now());
 update public.practice_sessions set last_activity_at=now(),updated_at=now() where id=p_session_id;
 question_id:=d.question_id; question_position:=v_pos; nble_type:=d.nble_type; decision_id:=d.decision_id; return next;
end $function$;
