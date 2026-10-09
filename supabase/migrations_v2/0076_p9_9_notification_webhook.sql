alter table pie.security_alert add column if not exists provider_message_id text;
create unique index if not exists security_alert_provider_message_id_uq
on pie.security_alert(provider_message_id) where provider_message_id is not null;

create table if not exists pie.security_notification_delivery (
 id uuid primary key default gen_random_uuid(),
 provider text not null,
 provider_event_id text not null unique,
 provider_message_id text,
 event_type text not null,
 payload jsonb not null default '{}'::jsonb,
 received_at timestamptz not null default now()
);
revoke all on pie.security_notification_delivery from public,anon,authenticated;

create or replace function pie.apply_notification_delivery(
 p_provider text,p_provider_event_id text,p_provider_message_id text,p_event_type text,p_payload jsonb
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_alert uuid;
begin
 insert into pie.security_notification_delivery(provider,provider_event_id,provider_message_id,event_type,payload)
 values(p_provider,p_provider_event_id,p_provider_message_id,p_event_type,coalesce(p_payload,'{}'::jsonb))
 on conflict(provider_event_id) do update set received_at=now()
 returning id into v_id;

 select id into v_alert from pie.security_alert where provider_message_id=p_provider_message_id limit 1;
 if v_alert is not null then
   update pie.security_alert set
     notification_state=case
       when p_event_type in ('email.delivered','email.sent') then 'sent'
       when p_event_type in ('email.bounced','email.complained') then 'failed'
       else notification_state end,
     sent_at=coalesce(sent_at,now())
   where id=v_alert;
 end if;
 return v_id;
end $$;
revoke all on function pie.apply_notification_delivery(text,text,text,text,jsonb) from public,anon,authenticated;
