-- P9.8 live wiring mirror
-- Protected screenshot bucket, admin realtime alert access, screenshot finalization,
-- server-side enforcement completion, and retention cleanup.

insert into storage.buckets(id,name,public,file_size_limit)
values('security-evidence','security-evidence',false,5242880)
on conflict(id) do update set public=false,file_size_limit=5242880;

drop policy if exists security_evidence_insert_own on storage.objects;
create policy security_evidence_insert_own on storage.objects
for insert to authenticated
with check (bucket_id='security-evidence' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists security_evidence_select_admin on storage.objects;
create policy security_evidence_select_admin on storage.objects
for select to authenticated
using (bucket_id='security-evidence' and exists(
  select 1 from pie.security_admin_allowlist a where a.user_id=auth.uid() and a.enabled
));

alter table pie.security_alert enable row level security;
drop policy if exists security_alert_admin_select on pie.security_alert;
create policy security_alert_admin_select on pie.security_alert
for select to authenticated
using (exists(select 1 from pie.security_admin_allowlist a where a.user_id=auth.uid() and a.enabled));
revoke all on pie.security_alert from authenticated,anon;
grant select on pie.security_alert to authenticated;

do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='pie' and tablename='security_alert') then
   alter publication supabase_realtime add table pie.security_alert;
 end if;
exception when undefined_object then null;
end $$;

create or replace function public.finalize_my_security_screenshot(
 p_event_id uuid,p_storage_ref text,p_content_hash text,p_redaction_state text default 'redacted'
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_event pie.security_event%rowtype; v_evidence uuid; v_incident uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into v_event from pie.security_event where id=p_event_id and user_id=auth.uid() for update;
 if v_event.id is null then raise exception 'security event not found'; end if;
 if p_storage_ref is null or p_content_hash is null then raise exception 'evidence metadata required'; end if;
 select incident_id into v_incident from pie.security_event where id=p_event_id;
 v_evidence:=pie.add_security_evidence(v_incident,p_event_id,'screenshot',p_storage_ref,p_content_hash,p_redaction_state);
 update pie.security_event set screenshot_count=screenshot_count+1 where id=p_event_id;
 perform pie.recompute_security_incident(v_incident);
 if v_incident is not null then
   perform pie.create_security_alert(v_incident);
   perform pie.apply_security_enforcement(v_incident);
 end if;
 return v_evidence;
end $$;
grant execute on function public.finalize_my_security_screenshot(uuid,text,text,text) to authenticated;

create or replace function public.enforce_my_security_event(p_event_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_event pie.security_event%rowtype; v_incident uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into v_event from pie.security_event where id=p_event_id and user_id=auth.uid();
 if v_event.id is null then raise exception 'security event not found'; end if;
 select incident_id into v_incident from pie.security_event where id=p_event_id;
 if v_incident is not null then
   perform pie.create_security_alert(v_incident);
   perform pie.apply_security_enforcement(v_incident);
 end if;
 return true;
end $$;
grant execute on function public.enforce_my_security_event(uuid) to authenticated;

create or replace function pie.prune_security_evidence()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
 delete from pie.security_evidence ev
 where ev.created_at < now()-(select make_interval(days=>retention_days) from pie.security_screenshot_policy where id=true)
 returning 1 into v_count;
 return coalesce(v_count,0);
end $$;
revoke all on function pie.prune_security_evidence() from public,anon,authenticated;
