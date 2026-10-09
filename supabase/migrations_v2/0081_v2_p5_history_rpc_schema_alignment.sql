-- 0081: V2 MCQ history RPC aligned to the deployed schema.
--
-- The old P5 history RPC joined pie.adaptive_session, which is not part of the
-- V2 schema. Attempts are owned by public.user_attempts; session metadata is available from
-- public.practice_sessions when a valid owned session exists. Include legacy
-- answered attempts with no session ID, but never expose keys for those rows.
--
-- This migration intentionally does not create pie.adaptive_session or change
-- the separate PIE observation pipeline.
-- Pagination uses a composite (created_at, attempt_id) cursor so rows sharing
-- the same timestamp cannot be skipped between pages.

drop function if exists public.get_my_attempt_history(integer, timestamptz);

create function public.get_my_attempt_history(
  p_limit integer default 1000,
  p_before timestamptz default null,
  p_before_attempt_id uuid default null
)
returns table (
  attempt_id uuid,
  session_id uuid,
  session_mode text,
  question_id uuid,
  zyntra_id text,
  stem text,
  options jsonb,
  subject_id uuid,
  subject_name text,
  subtopic_id uuid,
  subtopic_name text,
  difficulty_tier text,
  lo_id uuid,
  lo_title text,
  concept_title text,
  selected_answer text,
  is_correct boolean,
  correct_answer text,
  explanation text,
  confidence_level smallint,
  time_taken_seconds integer,
  time_to_first_click integer,
  answer_changes_count integer,
  change_sequence jsonb,
  question_position integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'p_limit must be 1..5000' using errcode = '22023';
  end if;

  return query
  select
    ua.id,
    ua.session_id,
    coalesce(ps.config ->> 'mode', ps.session_type, 'legacy_orphan'),
    q.id,
    q.zyntra_id,
    q.stem,
    q.options,
    q.subject_id,
    s.name,
    q.subtopic_id,
    st.name,
    q.difficulty_tier,
    lo.id,
    lo.title,
    c.title,
    ua.selected_answer,
    ua.is_correct,
    case when ps.status = 'completed' then q.correct_answer else null end,
    case when ps.status = 'completed' then q.explanation else null end,
    ua.confidence_level,
    ua.time_taken_seconds,
    ua.time_to_first_click,
    ua.answer_changes_count,
    ua.change_sequence,
    ua.question_position,
    ua.created_at
  from public.user_attempts ua
  left join public.practice_sessions ps
    on ps.id = ua.session_id
   and ps.user_id = v_uid
  join public.questions q
    on q.id = ua.question_id
  left join public.subjects s
    on s.id = q.subject_id
  left join public.subtopics st
    on st.id = q.subtopic_id
  left join pie.question_lo ql
    on ql.question_id = q.id
   and ql.is_primary
  left join pie.learning_objective lo
    on lo.id = ql.lo_id
  left join pie.concept c
    on c.id = lo.concept_id
  where ua.user_id = v_uid
    and (ua.session_id is null or ps.id is not null)
    and (
      p_before is null
      or ua.created_at < p_before
      or (
        ua.created_at = p_before
        and p_before_attempt_id is not null
        and ua.id < p_before_attempt_id
      )
    )
  order by ua.created_at desc, ua.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_my_attempt_history(integer, timestamptz, uuid)
  from public, anon;
grant execute on function public.get_my_attempt_history(integer, timestamptz)
  to authenticated, service_role;

notify pgrst, 'reload schema';
