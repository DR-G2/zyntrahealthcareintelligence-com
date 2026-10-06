-- Zyntra V2 Phase 7 / learner-view privilege correction
-- Views are deliberately security-definer projections over server-owned content tables.
-- They expose only learner-safe columns.

create or replace view public.questions_for_learner as
select
  id, zyntra_id, subject_id, subtopic_id, stem, options,
  explanation, difficulty_tier, status, version
from public.questions
where status = 'active';

create or replace view public.clinical_stations_for_learner as
select
  id, zyntra_id, subject, scenario_title, candidate_instructions,
  scenario_data, reading_time_minutes, station_time_minutes,
  status, version
from public.clinical_stations
where status = 'active';

revoke all on public.questions_for_learner from public, anon, authenticated;
revoke all on public.clinical_stations_for_learner from public, anon, authenticated;

grant select on public.questions_for_learner to anon, authenticated;
grant select on public.clinical_stations_for_learner to anon, authenticated;
