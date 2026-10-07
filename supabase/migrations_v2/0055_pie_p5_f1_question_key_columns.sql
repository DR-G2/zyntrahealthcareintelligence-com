-- 0055: P5 F1 - answer key and explanation are never readable from public.questions by
-- learners. Explanations reach a learner only through get_practice_session_results, and
-- only for questions they answered (0053). correct_answer was already column-revoked; this
-- revokes explanation (and re-asserts correct_answer) for anon/authenticated and rebuilds
-- public.questions_for_learner (security_invoker) without the explanation value. The view
-- keeps its column shape (explanation is always NULL) for client compatibility.
revoke select (explanation, correct_answer) on public.questions from public, anon, authenticated;

create or replace view public.questions_for_learner with (security_invoker = true) as
select id, zyntra_id, subject_id, subtopic_id, stem, options, null::text as explanation,
       difficulty_tier, status, version
from public.questions where status = 'active';
revoke all on public.questions_for_learner from public, anon;
grant select on public.questions_for_learner to authenticated;
comment on view public.questions_for_learner is
  'Learner-safe question view (security_invoker). No answer key or explanation (0055). Explanations come only from get_practice_session_results for answered questions.';

notify pgrst, 'reload schema';
