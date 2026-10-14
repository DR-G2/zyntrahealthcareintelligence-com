-- P2c: two-phase audit (pending before the action, done/failed after). NOT APPLIED. Idempotent.
-- status DEFAULT stays 'done' (FIX-2, minimal + safe):
--   * existing rows are backfilled as 'done' (they were written after their action);
--   * command.write_audit() (SECURITY DEFINER, does not name status) keeps producing 'done' rows,
--     with no function rewrite;
--   * the edge two-phase writer (_shared/command-audit.ts auditBegin) ALWAYS sets status='pending' explicitly.
alter table command.admin_activity_logs add column if not exists status text not null default 'done';
alter table command.admin_activity_logs alter column status set default 'done';
do $c$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'command.admin_activity_logs'::regclass
                   and conname = 'admin_activity_logs_status_check') then
    alter table command.admin_activity_logs
      add constraint admin_activity_logs_status_check check (status in ('pending', 'done', 'failed'));
  end if;
end
$c$;

-- B2: edge functions use service_role. Live (2026-10-14) service_role has NO usage on schema command and
-- no table privileges. Grant exactly what the edge audit/guard paths need. GRANT is idempotent.
-- B2 ruling (Hank/Gus): the command schema is NOT exposed via the API. Edge functions reach it only through the
-- public SECURITY INVOKER RPCs below, executed as service_role, which therefore needs schema usage + table grants.
grant usage on schema command to service_role;
grant select, insert, update on table command.admin_activity_logs to service_role;  -- begin/finish/list + actor guard
grant select on table command.admin_roles to service_role;                          -- destructive-action admin guard
grant usage on schema pie to service_role;
grant select on table pie.security_admin_allowlist to service_role;                 -- destructive-action admin guard

-- (1) Pending row BEFORE the action. target_id is the caller-computed HMAC (never the raw id/email).
create or replace function public.command_audit_begin(
  p_actor_user_id uuid, p_actor_role text, p_action text, p_target_type text,
  p_target_id text, p_reason text, p_before jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $f$
declare v_id uuid;
begin
  insert into command.admin_activity_logs
    (actor_user_id, actor_role, action, target_type, target_id, reason, before_snapshot, status)
  values (p_actor_user_id, p_actor_role, p_action, p_target_type, p_target_id, p_reason, p_before, 'pending')
  returning id into v_id;
  return v_id;
end
$f$;

-- (2) pending -> done|failed (only a pending row can be finished).
create or replace function public.command_audit_finish(p_id uuid, p_status text, p_after jsonb)
returns boolean
language plpgsql security invoker set search_path = '' as $f$
declare v_n integer;
begin
  if p_status not in ('done', 'failed') then
    raise exception 'invalid audit status' using errcode = '22023';
  end if;
  update command.admin_activity_logs
     set status = p_status, after_snapshot = p_after
   where id = p_id and status = 'pending';
  get diagnostics v_n = row_count;
  return v_n = 1;
end
$f$;

-- (3) 'admin' if the user is (or acted as) an admin anywhere; else 'clear'. Destructive actions refuse 'admin'.
create or replace function public.command_admin_target_status(p_user_id uuid)
returns text
language sql stable security invoker set search_path = '' as $f$
  select case when exists (select 1 from pie.security_admin_allowlist a where a.user_id = p_user_id)
               or exists (select 1 from command.admin_roles r where r.user_id = p_user_id)
               or exists (select 1 from command.admin_activity_logs l where l.actor_user_id = p_user_id)
              then 'admin' else 'clear' end
$f$;

-- (4) Read path for admin-user-actions get_logs (newest first, capped).
create or replace function public.command_audit_list(p_limit integer default 500)
returns setof command.admin_activity_logs
language sql stable security invoker set search_path = '' as $f$
  select * from command.admin_activity_logs
   order by created_at desc
   limit least(greatest(coalesce(p_limit, 500), 1), 500)
$f$;

-- EXECUTE: service_role only (V2 default privileges would otherwise grant anon/authenticated).
revoke execute on function public.command_audit_begin(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.command_audit_finish(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.command_admin_target_status(uuid) from public, anon, authenticated;
revoke execute on function public.command_audit_list(integer) from public, anon, authenticated;
grant execute on function public.command_audit_begin(uuid, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.command_audit_finish(uuid, text, jsonb) to service_role;
grant execute on function public.command_admin_target_status(uuid) to service_role;
grant execute on function public.command_audit_list(integer) to service_role;

-- No client role may touch the audit log (no anon/authenticated grants anywhere in this file).
revoke all on table command.admin_activity_logs from anon, authenticated;

-- write_audit (0016) is a plain SECURITY DEFINER function returning uuid (not a trigger fn; live 2026-10-14:
-- no triggers use it; ACL was postgres + authenticated). Clients must not write the audit log: REVOKE is idempotent.
revoke execute on function command.write_audit(text, text, text, text, jsonb, jsonb, uuid) from public, anon, authenticated;

-- Smoke for Gus after apply (expect: all false):
--   select r, has_function_privilege(r, 'command.write_audit(text,text,text,text,jsonb,jsonb,uuid)', 'EXECUTE')
--     from unnest(array['anon','authenticated']) r;
--   select r, f, has_function_privilege(r, f, 'EXECUTE') from unnest(array['anon','authenticated']) r,
--     unnest(array['public.command_audit_begin(uuid,text,text,text,text,text,jsonb)',
--                  'public.command_audit_finish(uuid,text,jsonb)',
--                  'public.command_admin_target_status(uuid)',
--                  'public.command_audit_list(integer)']) f;
