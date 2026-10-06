-- Phase 4 / 0012: schema permissions
-- RLS remains the primary row-level boundary.

revoke all on schema intelligence from anon, authenticated;
revoke all on schema pie from anon, authenticated;
revoke all on schema amc from anon, authenticated;
revoke all on schema command from anon, authenticated;
revoke all on schema ai_lab from anon, authenticated;
revoke all on schema migration from anon, authenticated;

-- Safe learner reads/writes are granted table-by-table through RLS where needed.
grant usage on schema intelligence to authenticated;
grant usage on schema pie to authenticated;
grant usage on schema amc to authenticated;
-- command/ai_lab/migration remain server-side by default.

grant select on intelligence.behavior_dna to authenticated;
grant select on intelligence.readiness_dna to authenticated;
grant select on intelligence.subject_dna to authenticated;
grant select on intelligence.confidence_intelligence to authenticated;
grant select on intelligence.candidate_interventions to authenticated;
grant select on intelligence.intervention_outcomes to authenticated;
grant select on intelligence.next_best_actions to authenticated;
grant insert on intelligence.behavior_events to authenticated;
grant select on intelligence.behavior_events to authenticated;

-- No grants are given to learner roles for sensitive benchmark/question DNA/PIE/admin/AI credential tables.
