-- Defense-in-depth: explicit deny policies for browser roles.
-- Grants are already revoked; service_role bypasses RLS for the server-only path.
create policy "p14_projection_no_client_access"
  on pie.inference_projection
  for all
  to anon, authenticated
  using (false)
  with check (false);
