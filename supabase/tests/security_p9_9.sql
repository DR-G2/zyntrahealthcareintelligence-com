-- P9.9 static database security assertions.

do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='pie' and table_name in ('security_event','security_evidence','security_enforcement','security_incident_event')
      and grantee in ('anon','authenticated') and privilege_type='SELECT'
  ) then
    raise exception 'raw security table SELECT exposed to API role';
  end if;

  if exists (select 1 from pie.security_event where user_id is null) then
    raise exception 'orphan security events exist';
  end if;

  if exists (select 1 from pie.security_incident where user_id is null) then
    raise exception 'orphan security incidents exist';
  end if;

  if exists (
    select 1 from pie.security_incident_event ie
    left join pie.security_event e on e.id=ie.event_id
    where e.id is null
  ) then
    raise exception 'dangling security incident event link exists';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='security_evidence_insert_own'
  ) then
    raise exception 'missing own-user screenshot upload policy';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='security_evidence_select_admin'
  ) then
    raise exception 'missing admin-only screenshot read policy';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='pie'
      and tablename='security_alert'
  ) then
    raise exception 'security_alert not enabled for realtime';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='check_my_ai_tutor_input'
  ) then
    raise exception 'AI Tutor security gateway RPC missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_my_security_capture_policy'
  ) then
    raise exception 'security capture policy RPC missing';
  end if;
end $$;
