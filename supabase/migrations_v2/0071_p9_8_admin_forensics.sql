create or replace function public.admin_security_feed()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_ok boolean;
begin
 select exists(select 1 from pie.security_admin_allowlist where user_id=auth.uid() and enabled) into v_ok;
 if not v_ok then raise exception 'admin access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'incident_id',i.id,'user_id',i.user_id,'user_email',(select u.email from auth.users u where u.id=i.user_id),
  'severity',i.severity,'status',i.status,'event_count',i.event_count,'screenshot_count',i.screenshot_count,
  'first_event_at',i.first_event_at,'last_event_at',i.last_event_at,'alert_state',coalesce(a.notification_state,'none'),
  'alert_id',a.id,'latest_ip',(select e.ip_address::text from pie.security_event e where e.user_id=i.user_id and e.severity in ('high','critical') order by e.created_at desc limit 1),
  'latest_user_agent',(select e.user_agent from pie.security_event e where e.user_id=i.user_id and e.severity in ('high','critical') order by e.created_at desc limit 1)
 ) order by case i.severity when 'critical' then 1 when 'high' then 2 else 3 end,i.last_event_at desc)
 from pie.security_incident i left join pie.security_alert a on a.incident_id=i.id
 where i.status in ('open','investigating')),'[]'::jsonb);
end $$;

create or replace function public.admin_security_incident_detail(p_incident_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_ok boolean; v_inc pie.security_incident%rowtype; v_json jsonb;
begin
 select exists(select 1 from pie.security_admin_allowlist where user_id=auth.uid() and enabled) into v_ok;
 if not v_ok then raise exception 'admin access required'; end if;
 select * into v_inc from pie.security_incident where id=p_incident_id;
 if v_inc.id is null then raise exception 'incident not found'; end if;
 v_json:=jsonb_set(to_jsonb(v_inc),'{user_email}',to_jsonb((select u.email from auth.users u where u.id=v_inc.user_id)),true);
 v_json:=jsonb_set(v_json,'{latest_ip}',to_jsonb((select e.ip_address::text from pie.security_event e where e.user_id=v_inc.user_id and e.severity in ('high','critical') order by e.created_at desc limit 1)),true);
 v_json:=jsonb_set(v_json,'{latest_user_agent}',to_jsonb((select e.user_agent from pie.security_event e where e.user_id=v_inc.user_id and e.severity in ('high','critical') order by e.created_at desc limit 1)),true);
 return jsonb_build_object(
  'incident',v_json,
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from pie.security_event e where e.user_id=v_inc.user_id and e.created_at between v_inc.first_event_at and v_inc.last_event_at and e.severity in ('high','critical')),'[]'::jsonb),
  'evidence',coalesce((select jsonb_agg(to_jsonb(ev) order by ev.created_at) from pie.security_evidence ev where ev.incident_id=p_incident_id),'[]'::jsonb),
  'alerts',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from pie.security_alert a where a.incident_id=p_incident_id),'[]'::jsonb)
 );
end $$;

revoke all on function public.admin_security_feed() from public,anon,authenticated;
revoke all on function public.admin_security_incident_detail(uuid) from public,anon,authenticated;
