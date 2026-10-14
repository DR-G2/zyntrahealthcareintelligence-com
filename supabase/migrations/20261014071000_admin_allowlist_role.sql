-- RUNBOOK (Mr. G, REQUIRED after apply): this migration sets every allowlist row to role='admin'.
-- Until one row is manually promoted, is_super_admin() returns false for EVERYONE and every super-admin
-- function denies all callers. The promotion below is a SEPARATE live write that needs Mr. G's own
-- explicit OK (not implied by approving this migration); run it only with that OK:
--   update pie.security_admin_allowlist set role = 'super_admin' where user_id = '<chosen user id>';
-- Admin tiers in the DB (Mr. G): role on pie.security_admin_allowlist + public.is_super_admin(). NOT applied live.
-- Requires 20261014051000 (is_admin) and 20261014070000 (user_id NOT NULL).
-- No row is promoted automatically: every existing row becomes 'admin'. At apply time Mr. G picks the super_admin:
--   update pie.security_admin_allowlist set role = 'super_admin' where user_id = '<chosen user id>';
DO $pre$
DECLARE bad boolean;
BEGIN
  IF to_regclass('pie.security_admin_allowlist') IS NULL THEN
    RAISE EXCEPTION 'pie.security_admin_allowlist does not exist';
  END IF;
  -- Nested + dynamic SQL: the role query must not be parsed/planned when the column is absent (live).
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'pie' AND table_name = 'security_admin_allowlist' AND column_name = 'role') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM pie.security_admin_allowlist WHERE role IS NULL OR role NOT IN (''admin'', ''super_admin''))' INTO bad;
    IF bad THEN
      RAISE EXCEPTION 'pie.security_admin_allowlist.role already exists with values outside (admin, super_admin); fix before applying';
    END IF;
  END IF;
END
$pre$;

alter table pie.security_admin_allowlist add column if not exists role text not null default 'admin';
DO $con$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'pie.security_admin_allowlist'::regclass AND conname = 'security_admin_allowlist_role_check') THEN
    ALTER TABLE pie.security_admin_allowlist
      ADD CONSTRAINT security_admin_allowlist_role_check CHECK (role IN ('admin', 'super_admin'));
  END IF;
END
$con$;

-- Hank: no client role may write the allowlist (or its role column). Explicit table + column revokes.
DO $rev$
DECLARE c text;
BEGIN
  REVOKE ALL ON TABLE pie.security_admin_allowlist FROM PUBLIC, anon, authenticated;
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid = 'pie.security_admin_allowlist'::regclass AND attnum > 0 AND NOT attisdropped LOOP
    EXECUTE format('REVOKE ALL (%I) ON TABLE pie.security_admin_allowlist FROM PUBLIC, anon, authenticated', c);
  END LOOP;
END
$rev$;

-- (1) The FULL is_admin() logic (user_id = auth.uid(), confirmed + lower-cased JWT email, enabled) AND role.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL OR NOT coalesce(public.is_admin(NULL), false) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM auth.users u
    JOIN pie.security_admin_allowlist a
      ON a.enabled = true AND a.user_id = u.id AND lower(a.email) = v_email AND a.role = 'super_admin'
    WHERE u.id = auth.uid() AND lower(u.email) = v_email AND u.email_confirmed_at IS NOT NULL
  );
END
$$;
-- V2 default privileges grant EXECUTE to anon/authenticated on new functions: revoke explicitly, then grant.
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Self-check
DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'pie.security_admin_allowlist'::regclass
                 AND attname = 'role' AND attnotnull AND NOT attisdropped)
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'pie.security_admin_allowlist'::regclass
                    AND conname = 'security_admin_allowlist_role_check' AND contype = 'c' AND convalidated
                    AND pg_get_constraintdef(oid) LIKE '%role%admin%super_admin%')
     -- (2) no client role holds ANY table privilege, nor any column-level grant, on the allowlist
     OR EXISTS (SELECT 1 FROM unnest(ARRAY['anon', 'authenticated']) r,
                       unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
                WHERE has_table_privilege(r, 'pie.security_admin_allowlist', p))
     OR EXISTS (SELECT 1 FROM unnest(ARRAY['anon', 'authenticated']) r
                WHERE has_column_privilege(r, 'pie.security_admin_allowlist', 'role', 'INSERT')
                   OR has_column_privilege(r, 'pie.security_admin_allowlist', 'role', 'UPDATE'))
     OR EXISTS (SELECT 1 FROM pg_attribute a, aclexplode(a.attacl) x
                LEFT JOIN pg_roles g ON g.oid = x.grantee
                WHERE a.attrelid = 'pie.security_admin_allowlist'::regclass AND a.attacl IS NOT NULL
                  AND (x.grantee = 0 OR g.rolname IN ('anon', 'authenticated')))
     OR EXISTS (SELECT 1 FROM pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
                WHERE c.oid = 'pie.security_admin_allowlist'::regclass AND x.grantee = 0)
     OR EXISTS (SELECT 1 FROM pie.security_admin_allowlist WHERE role NOT IN ('admin', 'super_admin'))
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.is_super_admin()'::regprocedure)
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.is_super_admin()'::regprocedure
                    AND proconfig @> ARRAY['search_path=""']::text[])
     OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                WHERE p.oid = 'public.is_super_admin()'::regprocedure
                  AND a.privilege_type = 'EXECUTE'
                  AND (a.grantee = 0 OR a.grantee = 'anon'::regrole))
     OR NOT has_function_privilege('authenticated', 'public.is_super_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION 'is_super_admin()/allowlist role/grants not as required';
  END IF;
  -- (3) CHECK is enforced: an invalid role must be rejected (rolled back via the sub-block).
  BEGIN
    UPDATE pie.security_admin_allowlist SET role = 'root' WHERE user_id = (SELECT user_id FROM pie.security_admin_allowlist LIMIT 1);
    IF FOUND THEN
      RAISE EXCEPTION 'role CHECK constraint did not reject an invalid role';
    END IF;
  EXCEPTION WHEN check_violation THEN
    NULL; -- expected
  END;
END
$chk$;
