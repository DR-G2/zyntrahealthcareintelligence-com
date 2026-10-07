revoke execute on function public.create_practice_session(text,jsonb,uuid[]) from anon;
revoke execute on function public.get_practice_session_questions(uuid) from anon;
revoke execute on function public.resume_practice_session(uuid) from anon;
revoke execute on function public.complete_practice_session(uuid) from anon;
revoke execute on function public.save_attempt(uuid,uuid,text,boolean,integer,smallint,integer,integer,jsonb,jsonb,text,integer,boolean,integer,text,jsonb) from anon;