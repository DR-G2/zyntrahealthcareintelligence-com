-- 0038: prevent explanation leakage during active Practice sessions
-- Explanations belong to completed results. The question-loading RPC keeps
-- its existing return shape for frontend compatibility but returns NULL
-- for explanation until get_practice_session_results is called.

create or replace function public.get_practice_session_questions(
  p_session_id uuid
)
returns table(
  session_question_id uuid,
  session_id uuid,
  question_id uuid,
  question_position integer,
  presented_at timestamptz,
  answered_at timestamptz,
  zyntra_id text,
  stem text,
  options jsonb,
  explanation text,
  subject_id uuid,
  subtopic_id uuid,
  difficulty_tier text,
  version integer
)
language sql
security definer
set search_path = public, pg_temp
as $function$
select
  psq.id,
  psq.session_id,
  psq.question_id,
  psq.position,
  psq.presented_at,
  psq.answered_at,
  q.zyntra_id,
  q.stem,
  q.options,
  null::text as explanation,
  q.subject_id,
  q.subtopic_id,
  q.difficulty_tier,
  q.version
from public.practice_session_questions psq
join public.practice_sessions ps
  on ps.id = psq.session_id
join public.questions q
  on q.id = psq.question_id
where ps.id = p_session_id
  and ps.user_id = auth.uid()
order by psq.position
$function$;
