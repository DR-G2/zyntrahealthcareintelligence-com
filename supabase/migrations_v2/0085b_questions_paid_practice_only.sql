-- 0085b_questions_paid_practice_only.sql — NOT APPLIED. Runs after 0085, before 0086 (0086 needs _assert_paid_pie_session). Target: V2 hkowvjazuwebmibssdut.
-- Rule (Mr. G): question content readable ONLY by paid users ONLY via PIE practice
--   (pie_create_session[mode=pie_adaptive] -> pie_next_question -> get_practice_session_questions / get_practice_session_results).
-- "Paid" = V2's own check from PR #87 @631d84e: public.current_user_can_read_questions()
--   (payment_row_entitled + manual_overrides + public.is_admin -> pie.security_admin_allowlist; ANY allowlist role bypasses), defined in 20261014051000. NOT redefined here.
-- ORDER: PR #87 migrations 20261014035000..051000, then PR #89 migrations_v2/0085 (get_practice_subject_counts),
--   THEN this file. Prechecks abort otherwise.
-- Kim review: all wrappers/helpers use search_path='' and fully schema-qualified names; original defaults kept;
--   originals renamed to public._impl_* and revoked; post-check fails if public wrappers lose the guard
--   (e.g. a re-run of 0083/0084 recreating an unguarded public.pie_create_session).
-- Status counts: get_my_attempt_history returns stems/options/answers -> revoked; replaced by
--   public.get_my_practice_status_counts() (own rows, counts only, no content).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ===== PRECHECKS =====
DO $$
DECLARE missing text; n_open integer; open_detail text;
BEGIN
  SELECT string_agg(c, ',') INTO missing FROM unnest(array['tier','trial_end_at','current_period_end','cancel_at_period_end']) c
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name=c);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'PREREQ: public.payments missing columns: % (apply PR #87 migrations to V2 first)', missing; END IF;
  IF to_regprocedure('public.current_user_can_read_questions()') IS NULL
     OR to_regprocedure('public.payment_row_entitled(public.payments)') IS NULL
  THEN RAISE EXCEPTION 'PREREQ: V2 paid check (current_user_can_read_questions / payment_row_entitled) missing; apply PR #87 20261014051000 first'; END IF;
  IF NOT (SELECT prosecdef FROM pg_catalog.pg_proc WHERE oid = 'public.current_user_can_read_questions()'::regprocedure)
  THEN RAISE EXCEPTION 'PREREQ: current_user_can_read_questions must be SECURITY DEFINER'; END IF;
  IF has_function_privilege('anon','public.current_user_can_read_questions()','EXECUTE')
  THEN RAISE EXCEPTION 'PREREQ: anon can execute current_user_can_read_questions'; END IF;
  IF to_regprocedure('public.get_practice_subject_counts()') IS NULL
  THEN RAISE EXCEPTION 'PREREQ: apply PR #89 migrations_v2/0085 (get_practice_subject_counts) before this lock, or Practice setup counts break'; END IF;
  IF to_regprocedure('public.pie_create_session(integer,text,text)') IS NULL
     OR to_regprocedure('public.pie_next_question(uuid)') IS NULL
     OR to_regprocedure('public.get_practice_session_questions(uuid)') IS NULL
     OR to_regprocedure('public.get_practice_session_results(uuid)') IS NULL
     OR to_regprocedure('public.get_my_attempt_history(integer,timestamptz,uuid)') IS NULL
  THEN RAISE EXCEPTION 'practice RPC signature drift'; END IF;
  IF pg_catalog.pg_get_function_arguments('public.pie_create_session(integer,text,text)'::regprocedure)
     <> 'p_count integer DEFAULT 10, p_blueprint_key text DEFAULT ''AMC_CAT_MCQ''::text, p_mode text DEFAULT ''pie_adaptive''::text'
  THEN RAISE EXCEPTION 'pie_create_session defaults drifted; update wrapper'; END IF;
  IF to_regprocedure('public._impl_pie_create_session(integer,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'already applied'; END IF;
  -- Open non-PIE-adaptive sessions would be stranded by the lock (live hkow 2026-10-14 10:19 IST per Gus P1: pie_diagnostic 1, pie_beta 1; closing them is its own Mr. G line).
  SELECT count(*), string_agg(t || ' ' || k, ', ') INTO n_open, open_detail FROM (
    SELECT session_type t, count(*)::text k FROM public.practice_sessions
     WHERE status IS DISTINCT FROM 'completed' AND session_type IS DISTINCT FROM 'pie_adaptive' GROUP BY 1) x;
  IF n_open > 0 THEN RAISE EXCEPTION 'open non-pie_adaptive practice_sessions exist (%); close/complete them first', open_detail; END IF;
END $$;

-- ===== 1. Close direct table/view access =====
REVOKE SELECT ON public.questions FROM anon, authenticated;
REVOKE SELECT (id, zyntra_id, subject_id, subtopic_id, stem, options, difficulty_tier, status, version)
  ON public.questions FROM anon, authenticated;
REVOKE ALL ON public.questions_for_learner FROM anon, authenticated;
-- RLS policy questions_select_published (roles=public) left in place; harmless without grants.

-- ===== 2. Revoke non-practice question-returning RPCs =====
REVOKE EXECUTE ON FUNCTION public.get_practice_question_pool(integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_practice_session(text, jsonb, uuid[]) FROM public, anon, authenticated;
-- get_my_attempt_history returns stem/options/correct_answer/explanation -> revoke; counts via new RPC below.
REVOKE EXECUTE ON FUNCTION public.get_my_attempt_history(integer, timestamptz, uuid) FROM public, anon, authenticated;

-- ===== 3. Rename originals to _impl_* and lock them =====
ALTER FUNCTION public.pie_create_session(integer,text,text) RENAME TO _impl_pie_create_session;
ALTER FUNCTION public.pie_next_question(uuid) RENAME TO _impl_pie_next_question;
ALTER FUNCTION public.get_practice_session_questions(uuid) RENAME TO _impl_get_practice_session_questions;
ALTER FUNCTION public.get_practice_session_results(uuid) RENAME TO _impl_get_practice_session_results;
REVOKE EXECUTE ON FUNCTION public._impl_pie_create_session(integer,text,text), public._impl_pie_next_question(uuid),
  public._impl_get_practice_session_questions(uuid), public._impl_get_practice_session_results(uuid) FROM public, anon, authenticated;

-- ===== 4. Guard helper =====
CREATE OR REPLACE FUNCTION public._assert_paid_pie_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_read_questions() THEN
    RAISE EXCEPTION 'PAYWALL: paid access required' USING errcode = '42501';
  END IF;
  IF p_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.practice_sessions s
     WHERE s.id = p_session_id AND s.user_id = auth.uid() AND s.session_type = 'pie_adaptive')
  THEN RAISE EXCEPTION 'PIE practice session required' USING errcode = '42501'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public._assert_paid_pie_session(uuid) FROM public, anon, authenticated;

-- ===== 5. Guarded public wrappers (defaults/return types copied from V2 pg_get_function_* 2026-10-14) =====
CREATE FUNCTION public.pie_create_session(p_count integer DEFAULT 10, p_blueprint_key text DEFAULT 'AMC_CAT_MCQ'::text, p_mode text DEFAULT 'pie_adaptive'::text)
RETURNS TABLE(session_id uuid, question_count integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public._assert_paid_pie_session(NULL);  -- PAID_PIE_GUARD
  IF p_mode IS DISTINCT FROM 'pie_adaptive' THEN RAISE EXCEPTION 'only pie_adaptive practice is allowed' USING errcode = '42501'; END IF;
  RETURN QUERY SELECT i.session_id, i.question_count FROM public._impl_pie_create_session(p_count, p_blueprint_key, p_mode) i;
END $$;

CREATE FUNCTION public.pie_next_question(p_session_id uuid)
RETURNS TABLE(question_id uuid, question_position integer, nble_type text, decision_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public._assert_paid_pie_session(p_session_id);  -- PAID_PIE_GUARD
  RETURN QUERY SELECT * FROM public._impl_pie_next_question(p_session_id);
END $$;

CREATE FUNCTION public.get_practice_session_questions(p_session_id uuid)
RETURNS TABLE(session_question_id uuid, session_id uuid, question_id uuid, question_position integer,
  presented_at timestamp with time zone, answered_at timestamp with time zone, zyntra_id text, stem text,
  options jsonb, explanation text, subject_id uuid, subtopic_id uuid, difficulty_tier text, version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public._assert_paid_pie_session(p_session_id);  -- PAID_PIE_GUARD
  RETURN QUERY SELECT * FROM public._impl_get_practice_session_questions(p_session_id);
END $$;

CREATE FUNCTION public.get_practice_session_results(p_session_id uuid)
RETURNS TABLE(session_question_id uuid, session_id uuid, question_id uuid, question_position integer,
  zyntra_id text, stem text, options jsonb, correct_answer text, explanation text, subject_id uuid,
  subtopic_id uuid, difficulty_tier text, version integer, selected_answer text, is_correct boolean,
  confidence_level smallint, time_taken_seconds integer, answer_changes_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public._assert_paid_pie_session(p_session_id);  -- PAID_PIE_GUARD
  RETURN QUERY SELECT * FROM public._impl_get_practice_session_results(p_session_id);
END $$;

-- ===== 6. Status counts without content (replaces get_my_attempt_history for Practice setup) =====
-- Own rows only; latest attempt per question; same session filter as get_my_attempt_history. No ids, no content.
CREATE FUNCTION public.get_my_practice_status_counts()
RETURNS TABLE(attempted integer, correct integer, incorrect integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode = '28000'; END IF;
  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (ua.question_id) ua.is_correct
      FROM public.user_attempts ua
      LEFT JOIN public.practice_sessions ps ON ps.id = ua.session_id AND ps.user_id = v_uid
     WHERE ua.user_id = v_uid AND (ua.session_id IS NULL OR ps.id IS NOT NULL)
     ORDER BY ua.question_id, ua.created_at DESC, ua.id DESC)
  SELECT count(*)::int, (count(*) FILTER (WHERE l.is_correct))::int, (count(*) FILTER (WHERE NOT l.is_correct))::int FROM latest l;
END $$;

REVOKE EXECUTE ON FUNCTION public.pie_create_session(integer,text,text), public.pie_next_question(uuid),
  public.get_practice_session_questions(uuid), public.get_practice_session_results(uuid),
  public.get_my_practice_status_counts() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.pie_create_session(integer,text,text), public.pie_next_question(uuid),
  public.get_practice_session_questions(uuid), public.get_practice_session_results(uuid),
  public.get_my_practice_status_counts() TO authenticated;

-- ===== POST-CHECKS =====
DO $$
DECLARE f text; cfg text[];
BEGIN
  IF has_column_privilege('authenticated','public.questions','stem','SELECT') OR has_column_privilege('anon','public.questions','stem','SELECT')
     OR has_column_privilege('authenticated','public.questions','options','SELECT') THEN RAISE EXCEPTION 'questions still readable'; END IF;
  IF has_function_privilege('authenticated','public.get_practice_question_pool(integer)','execute')
     OR has_function_privilege('authenticated','public.create_practice_session(text,jsonb,uuid[])','execute')
     OR has_function_privilege('authenticated','public.get_my_attempt_history(integer,timestamptz,uuid)','execute')
  THEN RAISE EXCEPTION 'non-practice RPC still executable'; END IF;
  FOREACH f IN ARRAY array['public._impl_pie_create_session(integer,text,text)','public._impl_pie_next_question(uuid)',
      'public._impl_get_practice_session_questions(uuid)','public._impl_get_practice_session_results(uuid)','public._assert_paid_pie_session(uuid)'] LOOP
    IF has_function_privilege('authenticated', f, 'execute') OR has_function_privilege('anon', f, 'execute')
    THEN RAISE EXCEPTION '% executable by client roles', f; END IF;
  END LOOP;
  -- Guard present in every public wrapper (catches a re-run of 0083/0084 recreating unguarded originals).
  FOREACH f IN ARRAY array['public.pie_create_session(integer,text,text)','public.pie_next_question(uuid)',
      'public.get_practice_session_questions(uuid)','public.get_practice_session_results(uuid)'] LOOP
    IF pg_catalog.pg_get_functiondef(f::regprocedure) NOT LIKE '%public._assert_paid_pie_session(%'
    THEN RAISE EXCEPTION '% lacks the paid PIE guard', f; END IF;
    IF has_function_privilege('anon', f, 'execute') THEN RAISE EXCEPTION '% executable by anon', f; END IF;
  END LOOP;
  IF pg_catalog.pg_get_functiondef('public.pie_create_session(integer,text,text)'::regprocedure) NOT LIKE '%public._impl_pie_create_session(%'
  THEN RAISE EXCEPTION 'public.pie_create_session does not delegate to _impl_pie_create_session'; END IF;
  FOREACH f IN ARRAY array['public._assert_paid_pie_session(uuid)','public.pie_create_session(integer,text,text)','public.pie_next_question(uuid)',
      'public.get_practice_session_questions(uuid)','public.get_practice_session_results(uuid)','public.get_my_practice_status_counts()'] LOOP
    SELECT proconfig INTO cfg FROM pg_catalog.pg_proc WHERE oid = f::regprocedure;
    IF cfg IS NULL OR NOT ('search_path=""' = ANY(cfg)) THEN RAISE EXCEPTION '% search_path not empty: %', f, cfg; END IF;
  END LOOP;
  IF has_schema_privilege('authenticated','pie','usage') OR has_schema_privilege('anon','pie','usage') THEN RAISE EXCEPTION 'pie schema usage granted'; END IF;
END $$;

COMMIT;

-- Standalone guard re-check (run after ANY later migration touching practice RPCs, e.g. a re-run of 0083/0084):
-- SELECT p.oid::regprocedure FROM pg_proc p WHERE p.oid IN ('public.pie_create_session(integer,text,text)'::regprocedure,
--   'public.pie_next_question(uuid)'::regprocedure,'public.get_practice_session_questions(uuid)'::regprocedure,
--   'public.get_practice_session_results(uuid)'::regprocedure) AND pg_get_functiondef(p.oid) NOT LIKE '%_assert_paid_pie_session(%';  -- must return 0 rows

-- ===== ROLLBACK (manual, separate txn) =====
-- BEGIN;
-- DROP FUNCTION public.pie_create_session(integer,text,text); DROP FUNCTION public.pie_next_question(uuid);
-- DROP FUNCTION public.get_practice_session_questions(uuid); DROP FUNCTION public.get_practice_session_results(uuid);
-- DROP FUNCTION public.get_my_practice_status_counts();
-- ALTER FUNCTION public._impl_pie_create_session(integer,text,text) RENAME TO pie_create_session;   (repeat for the other 3 _impl_*)
-- GRANT EXECUTE ON FUNCTION public.pie_create_session(integer,text,text), public.pie_next_question(uuid),
--   public.get_practice_session_questions(uuid), public.get_practice_session_results(uuid),
--   public.get_practice_question_pool(integer), public.create_practice_session(text,jsonb,uuid[]),
--   public.get_my_attempt_history(integer,timestamptz,uuid) TO authenticated;
-- GRANT SELECT (id,zyntra_id,subject_id,subtopic_id,stem,options,difficulty_tier,status,version) ON public.questions TO authenticated;
-- DROP FUNCTION public._assert_paid_pie_session(uuid);  -- paid-check functions belong to PR #87; do not drop
-- COMMIT;
