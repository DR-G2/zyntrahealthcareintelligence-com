-- 0085: targeted indexes for the authoritative PIE next-question selector.
-- Evidence: P20 production certification timed out in pie_next_question after
-- save_attempt had succeeded. These indexes support the exact session/user and
-- eligibility lookups in pie.rank_candidates / pie.decide.
-- This is a performance mitigation, not proof of the timeout's root cause.
-- Do not change selector policy, ranking weights, candidate eligibility, or P20/P21 gates.

create index if not exists practice_session_questions_session_question_idx
  on public.practice_session_questions(session_id, question_id);

create index if not exists user_attempts_user_session_idx
  on public.user_attempts(user_id, session_id)
  where session_id is not null;

create index if not exists decision_trace_user_session_idx
  on pie.decision_trace(user_id, session_id)
  where session_id is not null;

create index if not exists pie_question_quarantine_open_question_idx
  on pie.pie_question_quarantine(question_id)
  where status = 'open';

analyze public.practice_session_questions;
analyze public.user_attempts;
analyze pie.decision_trace;
analyze pie.pie_question_quarantine;
