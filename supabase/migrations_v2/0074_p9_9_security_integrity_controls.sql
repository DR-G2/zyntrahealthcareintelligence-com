-- P9.9 live hardening mirror.
-- Exact event-to-incident membership, evidence access audit, capture kill switch,
-- storage-reference validation and session-signal debounce are implemented live.

create table if not exists pie.security_incident_event (
  incident_id uuid not null references pie.security_incident(id) on delete cascade,
  event_id uuid not null unique references pie.security_event(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (incident_id,event_id)
);
revoke all on pie.security_incident_event from public, anon, authenticated;

create or replace function public.get_my_security_capture_policy()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v pie.security_screenshot_policy%rowtype;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into v from pie.security_screenshot_policy where id=true;
 return jsonb_build_object(
   'enabled',coalesce(v.enabled,true),
   'capture_scope',coalesce(v.capture_scope,'zyntra_viewport_only'),
   'allow_full_device_capture',coalesce(v.allow_full_device_capture,false),
   'redact_sensitive_fields',coalesce(v.redact_sensitive_fields,true)
 );
end $$;
grant execute on function public.get_my_security_capture_policy() to authenticated;

create or replace function public.admin_set_security_capture_enabled(p_enabled boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_ok boolean;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select exists(select 1 from pie.security_admin_allowlist where user_id=auth.uid() and enabled) into v_ok;
 if not v_ok then raise exception 'admin access required'; end if;
 update pie.security_screenshot_policy set enabled=p_enabled,updated_at=now() where id=true;
 return p_enabled;
end $$;
revoke all on function public.admin_set_security_capture_enabled(boolean) from public,anon;
grant execute on function public.admin_set_security_capture_enabled(boolean) to authenticated;

create or replace function public.admin_authorize_security_evidence_access(p_evidence_id uuid,p_action text default 'view',p_reason text default 'incident_review')
returns text language plpgsql security definer set search_path=''
as $$
declare v_ok boolean; v_ref text;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if p_action not in ('view','download') then raise exception 'invalid evidence action'; end if;
 select exists(select 1 from pie.security_admin_allowlist where user_id=auth.uid() and enabled) into v_ok;
 if not v_ok then raise exception 'admin access required'; end if;
 select storage_ref into v_ref from pie.security_evidence where id=p_evidence_id and evidence_type='screenshot';
 if v_ref is null then raise exception 'evidence not found'; end if;
 insert into pie.security_admin_access_audit(admin_user_id,evidence_id,action,reason)
 values(auth.uid(),p_evidence_id,p_action,left(coalesce(p_reason,'evidence review'),500));
 return v_ref;
end $$;
revoke all on function public.admin_authorize_security_evidence_access(uuid,text,text) from public,anon;
grant execute on function public.admin_authorize_security_evidence_access(uuid,text,text) to authenticated;

notify pgrst,'reload schema';
