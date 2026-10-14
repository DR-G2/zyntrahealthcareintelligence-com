-- 0086_paid_history_rpcs — DRAFT, NOT APPLIED. Apply as postgres AFTER 0085 and AFTER Hank's
-- questions_paid_practice_only.sql lock (prechecks abort otherwise).
-- Why: the lock revokes get_my_attempt_history (stems/options/keys) and direct question reads.
-- Learner history pages move to these RPCs:
--   PAID (entitlement via the lock's public._assert_paid_pie_session(NULL) -> current_user_can_read_questions(); 42501 when not paid):
--     get_my_practice_sessions(p_limit)        completed pie_adaptive sessions (ids/dates/counts, no content);
--                                              page then reads each via get_practice_session_results.
--     get_my_trust_gut_attempts(p_limit)       answer-change metadata; first-instinct correctness computed
--                                              server-side (no stem/options/explanation/key).
--     get_my_review_queue_attempts(p_limit)    review queue content; only attempts in the caller's own
--                                              COMPLETED pie_adaptive sessions.
--     get_my_attempt_summary(p_limit)          no content, no answers/keys: subject/subtopic/difficulty +
--                                              correctness/timing per attempt (Profile / StudyPlan / PI / MCP).
--                                              Paid-only per Mr. G decision 14 Oct 2026.
-- All: SECURITY DEFINER, SET search_path = '', REVOKE from PUBLIC/anon, GRANT EXECUTE to authenticated only.
-- Rollback: drop the four functions.
begin;

do $$
begin
  if to_regprocedure('public._assert_paid_pie_session(uuid)') is null
     or to_regprocedure('public.current_user_can_read_questions()') is null
     or to_regprocedure('public._impl_get_practice_session_results(uuid)') is null
  then raise exception 'PREREQ: apply questions_paid_practice_only.sql (paid practice lock) before 0086'; end if;
end $$;

create or replace function public.get_my_practice_sessions(p_limit integer default 50)
returns table(session_id uuid, created_at timestamptz, completed_at timestamptz, question_count integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._assert_paid_pie_session(null);  -- PAID_PIE_GUARD (42501 when not paid)
  if p_limit is null or p_limit < 1 or p_limit > 200 then raise exception 'p_limit must be 1..200' using errcode = '22023'; end if;
  return query
    select ps.id, ps.created_at, ps.completed_at,
           (select count(*)::int from public.practice_session_questions psq where psq.session_id = ps.id)
      from public.practice_sessions ps
     where ps.user_id = auth.uid() and ps.session_type = 'pie_adaptive' and ps.status = 'completed'
     order by ps.completed_at desc nulls last, ps.id desc
     limit p_limit;
end $$;

create or replace function public.get_my_trust_gut_attempts(p_limit integer default 5000)
returns table(attempt_id uuid, session_id uuid, question_id uuid, created_at timestamptz, subject_name text,
  subtopic_name text, selected_answer text, is_correct boolean, answer_changes_count integer, change_sequence jsonb,
  time_taken_seconds integer, time_to_first_click integer, first_answer_correct boolean, first_differs_from_final boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  perform public._assert_paid_pie_session(null);  -- PAID_PIE_GUARD
  if p_limit is null or p_limit < 1 or p_limit > 5000 then raise exception 'p_limit must be 1..5000' using errcode = '22023'; end if;
  return query
    select ua.id, ua.session_id, ua.question_id, ua.created_at, s.name, st.name, ua.selected_answer, ua.is_correct,
           ua.answer_changes_count, ua.change_sequence, ua.time_taken_seconds, ua.time_to_first_click,
           -- key compared server-side, only for completed sessions; the key itself is never returned
           case when ps.status = 'completed' and jsonb_typeof(ua.change_sequence) = 'array' and jsonb_array_length(ua.change_sequence) > 0
                then (ua.change_sequence ->> 0) = q.correct_answer end,
           case when jsonb_typeof(ua.change_sequence) = 'array' and jsonb_array_length(ua.change_sequence) > 0
                then (ua.change_sequence ->> 0) is distinct from ua.selected_answer end
      from public.user_attempts ua
      left join public.practice_sessions ps on ps.id = ua.session_id and ps.user_id = v_uid
      join public.questions q on q.id = ua.question_id
      left join public.subjects s on s.id = q.subject_id
      left join public.subtopics st on st.id = q.subtopic_id
     where ua.user_id = v_uid and (ua.session_id is null or ps.id is not null)
     order by ua.created_at desc, ua.id desc
     limit p_limit;
end $$;

create or replace function public.get_my_review_queue_attempts(p_limit integer default 2000)
returns table(attempt_id uuid, session_id uuid, session_mode text, question_id uuid, zyntra_id text, stem text, options jsonb,
  subject_id uuid, subject_name text, subtopic_id uuid, subtopic_name text, difficulty_tier text, lo_id uuid, lo_title text,
  concept_title text, selected_answer text, is_correct boolean, correct_answer text, explanation text, confidence_level smallint,
  time_taken_seconds integer, time_to_first_click integer, answer_changes_count integer, change_sequence jsonb,
  question_position integer, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  perform public._assert_paid_pie_session(null);  -- PAID_PIE_GUARD
  if p_limit is null or p_limit < 1 or p_limit > 5000 then raise exception 'p_limit must be 1..5000' using errcode = '22023'; end if;
  return query
    select ua.id, ua.session_id, ps.session_type, q.id, q.zyntra_id, q.stem, q.options, q.subject_id, s.name,
           q.subtopic_id, st.name, q.difficulty_tier, lo.id, lo.title, c.title, ua.selected_answer, ua.is_correct,
           q.correct_answer, q.explanation, ua.confidence_level, ua.time_taken_seconds, ua.time_to_first_click,
           ua.answer_changes_count, ua.change_sequence, ua.question_position, ua.created_at
      from public.user_attempts ua
      join public.practice_sessions ps on ps.id = ua.session_id and ps.user_id = v_uid
       and ps.session_type = 'pie_adaptive' and ps.status = 'completed'
      join public.questions q on q.id = ua.question_id
      left join public.subjects s on s.id = q.subject_id
      left join public.subtopics st on st.id = q.subtopic_id
      left join pie.question_lo ql on ql.question_id = q.id and ql.is_primary
      left join pie.learning_objective lo on lo.id = ql.lo_id
      left join pie.concept c on c.id = lo.concept_id
     where ua.user_id = v_uid
     order by ua.created_at desc, ua.id desc
     limit p_limit;
end $$;

create or replace function public.get_my_attempt_summary(p_limit integer default 5000)
returns table(attempt_id uuid, session_id uuid, created_at timestamptz, subject_name text, subtopic_name text,
  difficulty_tier text, is_correct boolean, confidence_level smallint, time_taken_seconds integer, answer_changes_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  perform public._assert_paid_pie_session(null);  -- PAID_PIE_GUARD (42501 when not paid)
  if p_limit is null or p_limit < 1 or p_limit > 5000 then raise exception 'p_limit must be 1..5000' using errcode = '22023'; end if;
  return query
    select ua.id, ua.session_id, ua.created_at, s.name, coalesce(st.name, lo.title), q.difficulty_tier,
           ua.is_correct, ua.confidence_level, ua.time_taken_seconds, ua.answer_changes_count
      from public.user_attempts ua
      left join public.practice_sessions ps on ps.id = ua.session_id and ps.user_id = v_uid
      join public.questions q on q.id = ua.question_id
      left join public.subjects s on s.id = q.subject_id
      left join public.subtopics st on st.id = q.subtopic_id
      left join pie.question_lo ql on ql.question_id = q.id and ql.is_primary
      left join pie.learning_objective lo on lo.id = ql.lo_id
     where ua.user_id = v_uid and (ua.session_id is null or ps.id is not null)
     order by ua.created_at desc, ua.id desc
     limit p_limit;
end $$;

revoke all on function public.get_my_practice_sessions(integer), public.get_my_trust_gut_attempts(integer),
  public.get_my_review_queue_attempts(integer), public.get_my_attempt_summary(integer) from public, anon;
grant execute on function public.get_my_practice_sessions(integer), public.get_my_trust_gut_attempts(integer),
  public.get_my_review_queue_attempts(integer), public.get_my_attempt_summary(integer) to authenticated;

-- Self-check
do $$
declare f text; cfg text[];
begin
  foreach f in array array['public.get_my_practice_sessions(integer)','public.get_my_trust_gut_attempts(integer)',
      'public.get_my_review_queue_attempts(integer)','public.get_my_attempt_summary(integer)'] loop
    if not (select prosecdef from pg_catalog.pg_proc where oid = f::regprocedure) then raise exception '0086: % not SECURITY DEFINER', f; end if;
    select proconfig into cfg from pg_catalog.pg_proc where oid = f::regprocedure;
    if cfg is null or not (cfg && array['search_path=""','search_path=']) then raise exception '0086: % search_path not empty: %', f, cfg; end if;
    if has_function_privilege('anon', f, 'EXECUTE') then raise exception '0086: anon can execute %', f; end if;
    if exists (select 1 from pg_catalog.pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where p.oid = f::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE')
    then raise exception '0086: PUBLIC can execute %', f; end if;
    if not has_function_privilege('authenticated', f, 'EXECUTE') then raise exception '0086: authenticated cannot execute %', f; end if;
  end loop;
  foreach f in array array['public.get_my_practice_sessions(integer)','public.get_my_trust_gut_attempts(integer)',
      'public.get_my_review_queue_attempts(integer)','public.get_my_attempt_summary(integer)'] loop
    if pg_catalog.pg_get_functiondef(f::regprocedure) not like '%public._assert_paid_pie_session(null)%'
    then raise exception '0086: % lacks the paid guard', f; end if;
  end loop;
end $$;

commit;
notify pgrst, 'reload schema';
