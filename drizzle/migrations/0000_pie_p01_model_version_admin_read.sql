-- PIE P01 follow-up: restrict the model registry read to administrators.
--
-- pie_model_version holds internal inference-layer metadata (model family,
-- version, state/observation schema versions, status, assumptions). It is not
-- candidate-facing: no browser code selects from it. The original policy
-- (pie_model_version_authenticated_read, USING (true)) let every signed-in
-- candidate read every row, so it is replaced with the same admin predicate the
-- rest of the platform uses (is_admin over the JWT email, backed by admin_roles).
--
-- service_role policies are unchanged: the PIE edge functions keep full access.

drop policy if exists "pie_model_version_authenticated_read" on public.pie_model_version;

create policy "pie_model_version_admin_read"
on public.pie_model_version
for select to authenticated
using (public.is_admin((auth.jwt() ->> 'email')));
