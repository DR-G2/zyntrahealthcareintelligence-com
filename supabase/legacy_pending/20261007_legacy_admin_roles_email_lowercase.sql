-- =============================================================================================
-- LEGACY project (yudkfmgilucyhukfggij) ONLY. NOT APPLIED. Kept outside supabase/migrations so
-- no pipeline auto-applies it. Apply manually (SQL editor, role postgres).
--
-- WHY: admin edge functions (admin-question-bank, admin-pie-certification, admin-pie-inspect-user,
-- admin-manage-questions, admin-cleanup-questions) lower-case + trim the caller's email and look
-- it up with an exact .eq, then re-check the returned row lower-cased. PostgREST cannot lower() the
-- column side, so this makes the stored side lower-case by construction:
--   1. normalise admin_roles.email to lower(btrim(email)) (aborts on duplicates instead of merging);
--   2. CHECK constraint admin_roles_email_lowercase so it stays that way;
--   3. SQL helpers is_admin(_email) and current_user_can_read_questions() compare lower() on both
--      sides (pie_is_admin() already does).
-- WHEN: before (or together with) deploying the edge functions from this branch. Until then a
-- mixed-case admin row only fails CLOSED (that admin gets 403), never open.
-- =============================================================================================
--
-- PRECHECK BEGIN (READ-ONLY: SELECT only)
-- select id, email, lower(btrim(email)) as normalised, role, email <> lower(btrim(email)) as needs_change
-- from public.admin_roles order by needs_change desc, email;
-- select lower(btrim(email)) as normalised, count(*) as n, array_agg(email) as variants
-- from public.admin_roles group by 1 having count(*) > 1;
-- select conname from pg_constraint where conrelid = 'public.admin_roles'::regclass;
-- PRECHECK END
-- =============================================================================================

begin;
set local lock_timeout = '5s';
lock table public.admin_roles in share row exclusive mode;

do $$
declare v_dups text;
begin
  select string_agg(format('%s (%s)', k, v), '; ') into v_dups from (
    select lower(btrim(email)) as k, string_agg(email, ', ') as v
    from public.admin_roles group by 1 having count(*) > 1) d;
  if v_dups is not null then
    raise exception 'admin_roles has duplicate emails under lower-case, resolve by hand first: %', v_dups;
  end if;
end $$;

update public.admin_roles set email = lower(btrim(email)) where email <> lower(btrim(email));

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.admin_roles'::regclass
                 and conname = 'admin_roles_email_lowercase') then
    alter table public.admin_roles
      add constraint admin_roles_email_lowercase check (email = lower(btrim(email)));
  end if;
end $$;

create or replace function public.is_admin(_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_roles where lower(email) = lower(btrim(_email)))
$$;

create or replace function public.current_user_can_read_questions()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.payments where user_id = auth.uid() and status = 'active')
    or exists (select 1 from public.manual_overrides where user_id = auth.uid() and (expires_at is null or expires_at > now()))
    or exists (select 1 from public.admin_roles where lower(email) = lower(btrim(auth.jwt() ->> 'email')))
  )
$$;
revoke execute on function public.current_user_can_read_questions() from anon, public;
grant execute on function public.current_user_can_read_questions() to authenticated;

do $$ begin
  if exists (select 1 from public.admin_roles where email <> lower(btrim(email))) then
    raise exception 'admin_roles still has non-lower-case emails';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.admin_roles'::regclass
                 and conname = 'admin_roles_email_lowercase' and convalidated) then
    raise exception 'admin_roles_email_lowercase constraint missing or not validated';
  end if;
  raise notice 'admin_roles lowercase check passed';
end $$;

commit;
