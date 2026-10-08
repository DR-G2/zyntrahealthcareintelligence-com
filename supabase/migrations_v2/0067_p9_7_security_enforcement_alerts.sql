-- P9.7 security alerts, enforcement, learner notices, and practice-window signals

create table if not exists pie.security_admin_allowlist(
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
insert into pie.security_admin_allowlist(user_id,email,enabled)
values('4344236e-8086-4bde-9c5a-c23d6a697b06','gopalrock.naren@gmail.com',true)
on conflict(user_id) do update set email=excluded.email,enabled=true;
revoke all on pie.security_admin_allowlist from anon,authenticated;

-- Safe to apply after P9.6 security evidence foundation.

create table if not exists pie.security_alert(
 id uuid primary key default gen_random_uuid(),
 incident_id uuid not null references pie.security_incident(id) on delete cascade,
 severity text not null check(severity in ('high','critical')),
 title text not null,
 category text not null,
 summary text not null,
 notification_state text not null default 'pending'
   check(notification_state in ('pending','sent','acknowledged','failed')),
 notification_channels text[] not null default '{}',
 dedupe_key text unique,
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 acknowledged_at timestamptz
);

create index if not exists security_alert_created_idx on pie.security_alert(created_at desc);
revoke all on pie.security_alert from anon,authenticated;

create table if not exists pie.security_enforcement(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 incident_id uuid references pie.security_incident(id) on delete set null,
 severity text not null check(severity in ('high','critical')),
 action text not null default 'temporary_ban',
 starts_at timestamptz not null default now(),
 ends_at timestamptz not null,
 reason text not null,
 created_at timestamptz not null default now()
);
create index if not exists security_enforcement_user_active_idx
on pie.security_enforcement(user_id, ends_at desc);
revoke all on pie.security_enforcement from anon,authenticated;

create table if not exists pie.security_user_notice(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 severity text not null check(severity in ('low','medium')),
 title text not null,
 message text not null,
 tracked_summary jsonb not null default '{}'::jsonb,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists security_user_notice_user_idx
on pie.security_user_notice(user_id,created_at desc);
revoke all on pie.security_user_notice from anon,authenticated;

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
 insert into pie.security_alert(incident_id,severity,title,category,summary,notification_channels,dedupe_key)
 values(v_incident.id,v_incident.severity,
  case when v_incident.severity='critical' then 'CRITICAL Zyntra security incident'
       else 'HIGH Zyntra security alert' end,
  v_category,
  format('%s security incident with %s high/critical event(s) and %s screenshot(s).',
    upper(v_incident.severity),v_incident.event_count,v_incident.screenshot_count),
  case when v_incident.severity='critical'
       then array['admin_realtime','admin_email'] else array['admin_realtime'] end,
  v_incident.id::text||':'||v_incident.severity)
 on conflict(dedupe_key) do update set severity=excluded.severity,title=excluded.title,summary=excluded.summary
 returning id into v_alert;
 return v_alert;
end $$;
revoke all on function pie.create_security_alert(uuid) from public,anon,authenticated;

create or replace function pie.apply_security_enforcement(p_incident_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_inc pie.security_incident%rowtype; v_end timestamptz; v_id uuid;
begin
 select * into v_inc from pie.security_incident where id=p_incident_id;
 if v_inc.id is null then raise exception 'incident not found'; end if;
 if v_inc.severity not in ('high','critical') then return null; end if;
 v_end:=now()+case when v_inc.severity='critical' then interval '24 hours' else interval '2 hours' end;
 insert into pie.security_enforcement(user_id,incident_id,severity,action,starts_at,ends_at,reason)
 values(v_inc.user_id,v_inc.id,v_inc.severity,'temporary_ban',now(),v_end,
  case when v_inc.severity='critical' then 'Critical security policy violation'
       else 'High security policy violation' end)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function pie.apply_security_enforcement(uuid) from public,anon,authenticated;

create or replace function public.get_my_security_enforcement()
returns jsonb language sql security definer set search_path=''
as $$
select coalesce(jsonb_agg(jsonb_build_object('severity',severity,'action',action,'starts_at',starts_at,'ends_at',ends_at,'reason',reason) order by ends_at desc),'[]'::jsonb)
from pie.security_enforcement where user_id=auth.uid() and ends_at>now()
$$;
grant execute on function public.get_my_security_enforcement() to authenticated;

create or replace function public.record_my_security_session_signal(p_signal_type text,p_severity text default 'info',p_value jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_event uuid; v_incident uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 insert into pie.security_session_signal(user_id,signal_type,severity,value)
 values(auth.uid(),p_signal_type,p_severity,p_value) returning id into v_id;
 if p_severity in ('high','critical') then
   v_event:=pie.record_security_event(auth.uid(),'PRACTICE_SECURITY_SIGNAL',p_severity,'practice_window_monitor',0.99,
     null,null,null,null,null,null,null,null,
     jsonb_build_object('signal_type',p_signal_type,'practice_window',true,'client_value',p_value),0,true,0,0);
   select incident_id into v_incident from pie.security_event where id=v_event;
   if v_incident is not null then
     perform pie.create_security_alert(v_incident);
     perform pie.apply_security_enforcement(v_incident);
   end if;
 elsif p_severity in ('low','medium') then
   insert into pie.security_user_notice(user_id,severity,title,message,tracked_summary)
   values(auth.uid(),p_severity,
    case when p_severity='medium' then 'Security activity detected' else 'Security activity noted' end,
    case when p_severity='medium'
      then 'A practice-session security signal was detected. Relevant session telemetry has been recorded for security review under Zyntra policy.'
      else 'A minor practice-session signal was detected. Limited telemetry has been recorded under Zyntra policy.' end,
    jsonb_build_object('signal_type',p_signal_type,'severity',p_severity,'practice_window',true,'recorded_at',now()));
 end if;
 return v_id;
end $$;
grant execute on function public.record_my_security_session_signal(text,text,jsonb) to authenticated;

create or replace function public.get_my_security_notices()
returns jsonb language sql security definer set search_path=''
as $$
select coalesce(jsonb_agg(jsonb_build_object('id',id,'severity',severity,'title',title,'message',message,'tracked_summary',tracked_summary,'created_at',created_at,'read_at',read_at) order by created_at desc),'[]'::jsonb)
from pie.security_user_notice where user_id=auth.uid() and created_at>now()-interval '30 days'
$$;
grant execute on function public.get_my_security_notices() to authenticated;

create or replace function public.record_my_security_event(
 p_event_type text,p_severity text,p_category text,p_confidence numeric default 1,
 p_session_id uuid default null,p_practice_session_id uuid default null,p_question_id uuid default null,
 p_evidence jsonb default '{}'::jsonb,p_screenshot_count integer default 0,p_blocked boolean default false)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_event uuid; v_incident uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 v_event:=pie.record_security_event(auth.uid(),p_event_type,p_severity,p_category,p_confidence,
   p_session_id,null,p_practice_session_id,p_question_id,null,null,null,null,
   p_evidence,p_screenshot_count,p_blocked,0,0);
 select incident_id into v_incident from pie.security_event where id=v_event;
 if p_severity in ('high','critical') and v_incident is not null then
   perform pie.create_security_alert(v_incident);
   perform pie.apply_security_enforcement(v_incident);
 end if;
 return v_event;
end $$;
grant execute on function public.record_my_security_event(text,text,text,numeric,uuid,uuid,uuid,jsonb,integer,boolean) to authenticated;

create or replace function public.admin_security_feed()
returns jsonb language sql security definer set search_path=''
as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'incident_id',i.id,'severity',i.severity,'status',i.status,'event_count',i.event_count,
 'screenshot_count',i.screenshot_count,'first_event_at',i.first_event_at,'last_event_at',i.last_event_at,
 'alert_state',coalesce(a.notification_state,'none'))
 order by case i.severity when 'critical' then 1 when 'high' then 2 else 3 end,i.last_event_at desc),'[]'::jsonb)
from pie.security_incident i left join pie.security_alert a on a.incident_id=i.id
where i.status in ('open','investigating')
$$;
revoke all on function public.admin_security_feed() from public,anon,authenticated;
