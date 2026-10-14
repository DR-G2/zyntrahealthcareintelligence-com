-- P2c: two-phase audit (pending before the action, done/failed after). NOT APPLIED. Idempotent.
-- 1) Add with default 'done' so every EXISTING row is backfilled as done (they were written after their action).
alter table command.admin_activity_logs add column if not exists status text not null default 'done';
-- 2) New rows default to 'pending' (two-phase writers set it explicitly anyway).
alter table command.admin_activity_logs alter column status set default 'pending';
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
-- Edge functions write via service_role only; no client role may touch the audit log.
revoke all on table command.admin_activity_logs from anon, authenticated;
