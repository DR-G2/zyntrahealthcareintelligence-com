-- P12 shadow inference: service-role read/write boundary.
--
-- pie-infer-state authenticates the caller with the user JWT, then uses the
-- service role to read that caller's pie.pie_observation and pie.pie_candidate_state
-- and to insert pie.inference_shadow only. Live certification failed with:
--   permission denied for table pie_observation
-- That is a table GRANT failure, not an RLS denial and not a missing column.
-- The same role can already resolve schema pie (otherwise Postgres reports
-- "permission denied for schema pie", which is what authenticated clients see).
--
-- Do not grant anon/authenticated usage or table access. RLS stays enabled.
-- Learner isolation remains in the Edge Function (user_id must match auth.uid()).

grant usage on schema pie to service_role;

grant select on table pie.pie_observation to service_role;
grant select on table pie.pie_candidate_state to service_role;
grant insert on table pie.inference_shadow to service_role;

alter table pie.pie_observation enable row level security;
alter table pie.pie_candidate_state enable row level security;
alter table pie.inference_shadow enable row level security;

drop policy if exists pie_observation_service_read on pie.pie_observation;
create policy pie_observation_service_read
  on pie.pie_observation
  for select
  to service_role
  using (true);

drop policy if exists pie_candidate_state_service_read on pie.pie_candidate_state;
create policy pie_candidate_state_service_read
  on pie.pie_candidate_state
  for select
  to service_role
  using (true);

drop policy if exists inference_shadow_service_insert on pie.inference_shadow;
create policy inference_shadow_service_insert
  on pie.inference_shadow
  for insert
  to service_role
  with check (true);

revoke all on table pie.pie_observation from anon, authenticated;
revoke all on table pie.pie_candidate_state from anon, authenticated;
revoke all on table pie.inference_shadow from anon, authenticated;
revoke all on schema pie from anon, authenticated;
