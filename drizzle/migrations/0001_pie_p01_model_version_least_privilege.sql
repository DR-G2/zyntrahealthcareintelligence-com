-- PIE P01 follow-up: least privilege on the model registry.
--
-- pie_model_version had arwdDxtm (select/insert/update/delete/truncate/references/trigger)
-- granted to anon and authenticated. Row-level security hides rows, but TRUNCATE,
-- REFERENCES and TRIGGER are not row-filtered, so a signed-in candidate held
-- table-wide powers over an internal inference-layer registry. The PIE edge
-- functions use service_role, and admin reads go through the admin-only SELECT
-- policy, so nothing needs those extra privileges.

revoke all on table public.pie_model_version from anon, authenticated;
grant select on table public.pie_model_version to authenticated;
grant all on table public.pie_model_version to service_role;
