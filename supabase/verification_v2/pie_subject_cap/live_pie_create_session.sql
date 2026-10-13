CREATE OR REPLACE FUNCTION public.pie_create_session(p_count integer DEFAULT 10, p_blueprint_key text DEFAULT 'AMC_CAT_MCQ'::text, p_mode text DEFAULT 'pie_adaptive'::text)
 RETURNS TABLE(session_id uuid, question_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid(); v_session uuid; v_pos integer:=0; d record;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_count is null or p_count<1 or p_count>50 then raise exception 'p_count must be 1..50' using errcode='22023'; end if;
 if p_mode not in ('pie_adaptive','pie_diagnostic') then raise exception 'invalid mode' using errcode='22023'; end if;
 insert into public.practice_sessions(user_id,session_type,status,config,started_at,last_activity_at)
 values(v_uid,p_mode,'active',jsonb_build_object('selector',case when p_mode='pie_adaptive' then 'pie' else 'diagnostic_fixed' end,'policy_version',case when p_mode='pie_adaptive' then 'pie-select/p3.0' else null end,'blueprint_key',p_blueprint_key,'mode',p_mode),now(),now())
 returning id into v_session;
 if p_mode='pie_diagnostic' then
   for d in select q.id question_id from public.questions q where q.status='active'
     and not exists(select 1 from public.practice_session_questions x where x.session_id=v_session and x.question_id=q.id)
     and not exists(select 1 from public.user_attempts ua where ua.user_id=v_uid and ua.question_id=q.id)
     order by q.id limit p_count loop
       insert into public.practice_session_questions(session_id,question_id,position,presented_at) values(v_session,d.question_id,v_pos,now()); v_pos:=v_pos+1;
   end loop;
 else
   for d in select * from pie.decide(v_uid,v_session,'SESSION_BUILD',p_count,'pie-select/p3.0',p_blueprint_key) loop
     insert into public.practice_session_questions(session_id,question_id,position,presented_at) values(v_session,d.question_id,v_pos,now()); v_pos:=v_pos+1;
   end loop;
 end if;
 if v_pos=0 then raise exception 'PIE_NO_ELIGIBLE_CANDIDATE: no questions available' using errcode='P0002'; end if;
 session_id:=v_session; question_count:=v_pos; return next;
end $function$;
