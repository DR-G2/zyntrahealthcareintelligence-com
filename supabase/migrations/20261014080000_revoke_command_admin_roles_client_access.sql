-- P2 cutover: edge functions now gate on public.is_admin() / public.is_super_admin() RPCs, so no client
-- role needs direct access to the legacy admin table. Idempotent; no-op if the table does not exist.
-- NOT applied live by this PR.
DO $rev$
BEGIN
  IF to_regclass('command.admin_roles') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE command.admin_roles FROM anon, authenticated';
  END IF;
END
$rev$;
