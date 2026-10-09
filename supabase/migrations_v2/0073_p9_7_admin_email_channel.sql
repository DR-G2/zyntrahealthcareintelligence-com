-- P9.7 admin email channel.
-- Runtime credentials are intentionally supplied as Supabase Edge Function secrets,
-- never stored in SQL or source control.

create or replace function pie.create_security_alert(p_incident_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_incident pie.security_incident%rowtype; v_category text; v_alert uuid;
begin
 select * into v_incident from pie.security_incident where id=p_incident_id;
 if v_incident.id is null then raise exception 'incident not found'; end if;
 if v_incident.severity not in ('high','critical') then return null; end if;

 select coalesce((select category from pie.security_event
   where user_id=v_incident.user_id and severity in ('high','critical')
     and created_at between v_incident.first_event_at and v_incident.last_event_at
   order by created_at desc limit 1),'security_event') into v_category;

 insert into pie.security_alert(
   incident_id,severity,title,category,summary,notification_channels,dedupe_key
 ) values(
   v_incident.id,v_incident.severity,
   case when v_incident.severity='critical' then 'CRITICAL Zyntra security incident'
        else 'HIGH Zyntra security alert' end,
   v_category,
   format('%s security incident with %s high/critical event(s) and %s screenshot(s).',
     upper(v_incident.severity),v_incident.event_count,v_incident.screenshot_count),
   array['admin_realtime','admin_email'],
   v_incident.id::text||':'||v_incident.severity
 )
 on conflict(dedupe_key) do update set
   severity=excluded.severity,title=excluded.title,summary=excluded.summary,
   notification_channels=excluded.notification_channels
 returning id into v_alert;

 return v_alert;
end $$;

notify pgrst,'reload schema';
