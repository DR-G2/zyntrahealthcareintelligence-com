-- Zyntra V2 Phase 12: secure Practice result delivery
-- Correct answers remain hidden during the active drill and are returned only
-- after the authenticated session is completed.

create or replace function public.get_practice_session_results(p_session_id uuid)
returns table(
  session_question_id uuid,
  session_id uuid,
  question_id uuid,
  question_position integer,
  zyntra_id text,
  stem text,
  options jsonb,
  explanation text,
  subject_id uuid,
  subtopic_id uuid,
  difficulty_tier text,
  version integer,
  selected_answer text,
  is_correct boolean,
  confidence_level smallint,
  time_taken_seconds integer,
  answer_changes_count integer
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
    q.zyntra_id,
    q.stem,
    q.options,
    q.explanation,
    q.subject_id,
    q.subtopic_id,
    q.difficulty_tier,
    q.version,
    ua.selected_answer,
    ua.is_correct,
    ua.confidence_level,
    ua.time_taken_seconds,
    ua.answer_changes_count
  from public.practice_session_questions psq
  join public.practice_sessions ps
    on ps.id = psq.session_id
  join public.questions q
    on q.id = psq.question_id
  left join lateral (
    select a.selected_answer, a.is_correct, a.confidence_level,
           a.time_taken_seconds, a.answer_changes_count
    from public.user_attempts a
    where a.session_id = psq.session_id
      and a.question_id = psq.question_id
      and a.user_id = auth.uid()
    order by a.created_at desc
    limit 1
  ) ua on true
  where ps.id = p_session_id
    and ps.user_id = auth.uid()
    and ps.status = 'completed'
  order by psq.position;
$function$;

revoke all on function public.get_practice_session_results(uuid) from public;
grant execute on function public.get_practice_session_results(uuid) to authenticated;