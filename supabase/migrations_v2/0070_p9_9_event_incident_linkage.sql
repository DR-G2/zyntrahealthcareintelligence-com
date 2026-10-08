-- security_event intentionally has no incident_id column.
-- Always derive the incident through pie.correlate_security_event(event_id).
-- This migration mirrors the live P9.9 gateway correction.

create or replace function public.check_my_ai_tutor_input(p_input text,p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v jsonb; v_event uuid; v_incident uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 v:=pie.security_classify_input(p_input,p_context);
 if (v->>'decision')='block' then
   v_event:=pie.record_security_event(auth.uid(),'AI_TUTOR_INPUT_BLOCKED',v->>'severity',v->>'category',(v->>'confidence')::numeric,null,null,null,null,null,null,null,null,
     jsonb_build_object('rule_key',v->>'rule_key','detector_version',v->>'detector_version','input_recorded',false),0,true,0,0);
   if v->>'severity' in ('high','critical') then
     v_incident:=pie.correlate_security_event(v_event);
     if v_incident is not null then perform pie.create_security_alert(v_incident); perform pie.apply_security_enforcement(v_incident); end if;
   end if;
   v:=v||jsonb_build_object('event_id',v_event);
 end if;
 return v;
end $$;

create or replace function public.record_my_security_session_signal(p_signal_type text,p_severity text default 'info',p_value jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_event uuid; v_incident uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 insert into pie.security_session_signal(user_id,signal_type,severity,value) values(auth.uid(),p_signal_type,p_severity,p_value) returning id into v_id;
 if p_severity in ('high','critical') then
   v_event:=pie.record_security_event(auth.uid(),'PRACTICE_SECURITY_SIGNAL',p_severity,'practice_window_monitor',0.99,null,null,null,null,null,null,null,null,jsonb_build_object('signal_type',p_signal_type,'practice_window',true,'client_value',p_value),0,true,0,0);
   v_incident:=pie.correlate_security_event(v_event);
   if v_incident is not null then perform pie.create_security_alert(v_incident); end if;
   return v_event;
 elsif p_severity in ('low','medium') then
   insert into pie.security_user_notice(user_id,severity,title,message,tracked_summary)
   values(auth.uid(),p_severity,case when p_severity='medium' then 'Security activity detected' else 'Security activity noted' end,
   case when p_severity='medium' then 'A practice-session security signal was detected. Relevant session telemetry has been recorded for security review under Zyntra policy.' else 'A minor practice-session signal was detected. Limited telemetry has been recorded under Zyntra policy.' end,
   jsonb_build_object('signal_type',p_signal_type,'severity',p_severity,'practice_window',true,'recorded_at',now()));
 end if;
 return v_id;
end $$;

grant execute on function public.check_my_ai_tutor_input(text,jsonb) to authenticated;
grant execute on function public.record_my_security_session_signal(text,text,jsonb) to authenticated;
