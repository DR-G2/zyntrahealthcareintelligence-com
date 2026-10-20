-- 0104: Candidate-wide Behaviour profile contract.
-- New analyses write one candidate-wide row per user. Preserve the legacy Normal MCQ
-- label during rollout so an existing row does not make this constraint migration fail;
-- the UI must withhold that old row from the candidate-wide view until it is re-analysed.
-- Mode-level evidence for new profiles is retained in archetype_signals.modeBreakdown.
begin;

alter table intelligence.behavior_profiles
  drop constraint if exists behavior_profiles_session_mode_check;

alter table intelligence.behavior_profiles
  add constraint behavior_profiles_session_mode_check
  check (session_mode in ('normal_mcq', 'candidate_wide'));

notify pgrst, 'reload schema';
commit;
