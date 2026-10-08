create or replace function public.check_my_ai_tutor_input(p_input text,p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v jsonb; v_event uuid; v_incident uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 v:=pie.security_classify_input(p_input,p_context);
 if (v->>'decision')='block' then
   v_event:=pie.record_security_event(auth.uid(),'AI_TUTOR_INPUT_BLOCKED',
     v->>'severity',v->>'category',(v->>'confidence')::numeric,
     null,null,null,null,null,null,null,null,
     jsonb_build_object('rule_key',v->>'rule_key','detector_version',v->>'detector_version','input_recorded',false),
     0,true,0,0);
   select incident_id into v_incident from pie.security_event where id=v_event;
   if v_incident is not null and v->>'severity' in ('high','critical') then
     perform pie.create_security_alert(v_incident);
     perform pie.apply_security_enforcement(v_incident);
   end if;
   v:=v||jsonb_build_object('event_id',v_event);
 end if;
 return v;
end $$;
grant execute on function public.check_my_ai_tutor_input(text,jsonb) to authenticated;
