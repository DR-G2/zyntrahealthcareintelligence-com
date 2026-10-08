-- P9.9 static database security assertions.
-- Run with the Supabase database test harness in CI.

do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='pie' and table_name='security_event'
      and grantee in ('anon','authenticated') and privilege_type='SELECT'
  ) then
    raise exception 'security_event SELECT exposed to API role';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='pie' and table_name='security_evidence'
      and grantee in ('anon','authenticated') and privilege_type='SELECT'
  ) then
    raise exception 'security_evidence SELECT exposed to API role';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='pie' and table_name='security_enforcement'
      and grantee in ('anon','authenticated') and privilege_type='SELECT'
  ) then
    raise exception 'security_enforcement SELECT exposed to API role';
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
end $$;
