-- V2 learner-view privilege hardening
-- Learner-facing intelligence/question/station views are read-only and authenticated-only.
revoke all on public.my_readiness from anon, authenticated;
revoke all on public.my_behavior_dna from anon, authenticated;
revoke all on public.my_subject_dna from anon, authenticated;
revoke all on public.my_confidence_intelligence from anon, authenticated;
revoke all on public.my_next_best_actions from anon, authenticated;
revoke all on public.questions_for_learner from anon, authenticated;
revoke all on public.clinical_stations_for_learner from anon, authenticated;

grant select on public.my_readiness to authenticated;
grant select on public.my_behavior_dna to authenticated;
grant select on public.my_subject_dna to authenticated;
grant select on public.my_confidence_intelligence to authenticated;
grant select on public.my_next_best_actions to authenticated;
grant select on public.questions_for_learner to authenticated;
grant select on public.clinical_stations_for_learner to authenticated;
