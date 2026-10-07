-- 0060: learner history RPCs (PIE attempts only). LOCAL-VERIFIED ONLY.
--  H1 get_my_attempt_history(p_limit, p_before): the caller's own attempts made in PIE
--     sessions (pie.adaptive_session: adaptive or diagnostic), newest first, with stem,
--     options, the learner's answer, server-graded correctness, confidence, timing and
--     change telemetry. correct_answer / explanation are returned ONLY because the row is an
--     attempt by this learner on that question (answered-only by construction); there is no
--     way to ask for a question the learner has not answered.
--  H2 get_my_review_due(p_limit): the caller's LOs whose spaced review is due (or due within
--     p_horizon_days), from pie.learner_lo_state. No question content, no keys.
--  Both: authenticated only, SECURITY DEFINER, auth.uid() scoped, read-only.

create or replace function public.get_my_attempt_history(p_limit integer default 1000, p_before timestamptz default null)
returns table(
  attempt_id uuid, session_id uuid, session_mode text, question_id uuid, zyntra_id text,
  stem text, options jsonb, subject_id uuid, subject_name text, subtopic_id uuid, subtopic_name text,
  difficulty_tier text, lo_id uuid, lo_title text, concept_title text,
  selected_answer text, is_correct boolean, correct_answer text, explanation text,
  confidence_level smallint, time_taken_seconds integer, time_to_first_click integer,
  answer_changes_count integer, change_sequence jsonb, question_position integer, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 5000 then raise exception 'p_limit must be 1..5000' using errcode = '22023'; end if;
  return query
  select ua.id, ua.session_id, a.mode, q.id, q.zyntra_id,
         q.stem, q.options, q.subject_id, s.name, q.subtopic_id, st.name,
         q.difficulty_tier, lo.id, lo.title, c.title,
         ua.selected_answer, ua.is_correct, q.correct_answer, q.explanation,
         ua.confidence_level, ua.time_taken_seconds, ua.time_to_first_click,
         ua.answer_changes_count, ua.change_sequence, ua.question_position, ua.created_at
  from public.user_attempts ua
  join pie.adaptive_session a on a.session_id = ua.session_id and a.user_id = v_uid
  join public.questions q on q.id = ua.question_id
  left join public.subjects s on s.id = q.subject_id
  left join public.subtopics st on st.id = q.subtopic_id
  left join pie.question_lo ql on ql.question_id = q.id and ql.is_primary
  left join pie.learning_objective lo on lo.id = ql.lo_id
  left join pie.concept c on c.id = lo.concept_id
  where ua.user_id = v_uid
    and (p_before is null or ua.created_at < p_before)
  order by ua.created_at desc, ua.id
  limit p_limit;
end $$;

create or replace function public.get_my_review_due(p_limit integer default 100, p_horizon_days integer default 0)
returns table(lo_id uuid, lo_title text, concept_title text, subject_name text, review_due_at timestamptz,
              overdue_days numeric, mastery numeric, mastery_confidence numeric, exposure_count integer, last_seen_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then raise exception 'p_limit must be 1..1000' using errcode = '22023'; end if;
  if p_horizon_days is null or p_horizon_days < 0 or p_horizon_days > 365 then raise exception 'p_horizon_days must be 0..365' using errcode = '22023'; end if;
  return query
  select s.lo_id, lo.title, c.title,
         (select sb.name from pie.question_lo ql join public.questions q on q.id = ql.question_id
            join public.subjects sb on sb.id = q.subject_id
           where ql.lo_id = s.lo_id and ql.is_primary order by q.id limit 1),
         s.review_due_at, round((extract(epoch from now() - s.review_due_at) / 86400)::numeric, 2),
         s.mastery, s.mastery_confidence, s.exposure_count, s.last_seen_at
  from pie.learner_lo_state s
  join pie.learning_objective lo on lo.id = s.lo_id
  left join pie.concept c on c.id = lo.concept_id
  where s.user_id = v_uid and s.review_due_at is not null
    and s.review_due_at <= now() + make_interval(days => p_horizon_days)
  order by s.review_due_at asc
  limit p_limit;
end $$;

revoke all on function public.get_my_attempt_history(integer, timestamptz) from public, anon;
revoke all on function public.get_my_review_due(integer, integer) from public, anon;
grant execute on function public.get_my_attempt_history(integer, timestamptz) to authenticated, service_role;
grant execute on function public.get_my_review_due(integer, integer) to authenticated, service_role;
notify pgrst, 'reload schema';
