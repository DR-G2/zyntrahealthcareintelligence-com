create or replace function public.create_practice_session(p_session_type text,p_config jsonb,p_question_ids uuid[])
returns public.practice_sessions language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_session public.practice_sessions; v_user uuid:=auth.uid(); v_question_id uuid; v_position integer:=0;
begin
if v_user is null then raise exception 'authentication required'; end if;
if coalesce(trim(p_session_type),'')='' then raise exception 'session_type is required'; end if;
if p_question_ids is null or coalesce(array_length(p_question_ids,1),0)=0 then raise exception 'at least one question is required'; end if;
if array_length(p_question_ids,1)>1000 then raise exception 'practice session cannot contain more than 1000 questions'; end if;
if exists(select 1 from unnest(p_question_ids) q(id) left join public.questions qn on qn.id=q.id where qn.id is null or qn.status<>'active') then raise exception 'one or more questions are not active'; end if;
insert into public.practice_sessions(user_id,session_type,status,config,started_at,last_activity_at) values(v_user,p_session_type,'active',coalesce(p_config,'{}'::jsonb),now(),now()) returning * into v_session;
foreach v_question_id in array p_question_ids loop
insert into public.practice_session_questions(session_id,question_id,position,presented_at) values(v_session.id,v_question_id,v_position,now());
v_position:=v_position+1;
end loop;
return v_session;
end
$function$;