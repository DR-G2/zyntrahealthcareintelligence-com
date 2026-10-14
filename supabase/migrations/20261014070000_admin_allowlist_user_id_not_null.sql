-- Admin checks follow-up (is_admin over pie.security_admin_allowlist). NOT applied live by this PR.
-- is_admin() matches allowlist.user_id = auth.uid(); a NULL user_id row can never match and hides config errors,
-- so require it. Live V2 (hkowvjazuwebmibssdut) at authoring: 1 row, 0 NULL user_id.
DO $pre$
DECLARE n int;
BEGIN
  IF to_regclass('pie.security_admin_allowlist') IS NULL THEN
    RAISE EXCEPTION 'pie.security_admin_allowlist does not exist; apply the PIE security migrations first';
  END IF;
  SELECT count(*) INTO n FROM pie.security_admin_allowlist WHERE user_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'pie.security_admin_allowlist has % row(s) with NULL user_id; fix before applying. Inspect: select email, enabled, created_at from pie.security_admin_allowlist where user_id is null;', n;
  END IF;
END
$pre$;

alter table pie.security_admin_allowlist alter column user_id set not null;

-- Self-check
DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'pie.security_admin_allowlist'::regclass AND attname = 'user_id' AND attnotnull AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'pie.security_admin_allowlist.user_id is not NOT NULL';
  END IF;
END
$chk$;
