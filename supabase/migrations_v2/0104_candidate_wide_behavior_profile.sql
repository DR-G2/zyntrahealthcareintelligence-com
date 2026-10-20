-- 0104: Candidate-wide Behaviour profile contract.
-- Each profile is one evolving candidate-wide summary; mode-level evidence is retained in
-- archetype_signals.modeBreakdown. This migration does not write or backfill production rows.
begin;

alter table intelligence.behavior_profiles
  drop constraint if exists behavior_profiles_session_mode_check;

alter table intelligence.behavior_profiles
  add constraint behavior_profiles_session_mode_check
  check (session_mode = 'candidate_wide');

notify pgrst, 'reload schema';
commit;
