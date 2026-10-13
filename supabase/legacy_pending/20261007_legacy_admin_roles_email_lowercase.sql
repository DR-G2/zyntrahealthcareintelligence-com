-- =============================================================================================
-- LEGACY project (yudkfmgilucyhukfggij) ONLY. NOT APPLIED. Kept outside supabase/migrations so
-- no pipeline auto-applies it. Apply manually (SQL editor, role postgres).
--
-- WHY: admin edge functions (admin-question-bank, admin-pie-certification, admin-pie-inspect-user,
-- admin-manage-questions, admin-cleanup-questions) lower-case + trim the caller's email and look
-- it up with an exact .eq, then re-check the returned row lower-cased. PostgREST cannot lower() the
-- column side, so this makes the stored side lower-case by construction:
--   1. normalise admin_roles.email to lower(btrim(email)) (aborts on duplicates instead of merging);
--   2. CHECK constraint admin_roles_email_lowercase so it stays that way.
-- It does NOT rewrite any function (Hank B2): the live bodies of is_admin(),
-- current_user_can_read_questions() etc. may differ from the repo, and a from-scratch rewrite could
-- silently drop live entitlement logic. With the stored side lower-case, the only remaining gap is a
-- mixed-case JWT email, which fails CLOSED. If Gus wants that closed too, see the OPTIONAL block at
-- the end (commented out; it patches only the email comparison of the live definition).
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

-- =============================================================================================
-- OPTIONAL (Gus, by hand, separately; NOT part of the transaction above). Do NOT rewrite from
-- scratch. For each helper that compares admin_roles.email (e.g. public.is_admin(text),
-- public.current_user_can_read_questions()):
--   1. pull the LIVE definition (read-only):
--        select pg_get_functiondef('public.current_user_can_read_questions()'::regprocedure);
--        select pg_get_functiondef('public.is_admin(text)'::regprocedure);
--   2. copy it verbatim and change ONLY the email comparison, e.g.
--        where email = (auth.jwt() ->> 'email')   ->   where email = lower(btrim(auth.jwt() ->> 'email'))
--        where email = _email                     ->   where email = lower(btrim(_email))
--      (stored side is already lower-case + constrained, so no lower() on the column is needed);
--      fully schema-qualify every reference (public.admin_roles, auth.jwt(), pg_catalog.lower) and set
--        SET search_path = ''
--      leaving everything else (SECURITY DEFINER, volatility, other branches, grants) unchanged;
--   3. run it in begin; ... ; then re-check the grants are unchanged:
--        select p.oid::regprocedure, p.proacl, p.prosecdef, p.proconfig from pg_proc p
--        where p.oid in ('public.is_admin(text)'::regprocedure, 'public.current_user_can_read_questions()'::regprocedure);
--      and commit only if they match the pre-change output.
-- -- begin;
-- -- <paste the edited pg_get_functiondef output here>
-- -- commit;
-- =============================================================================================
