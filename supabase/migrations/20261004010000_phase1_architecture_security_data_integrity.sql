-- Zyntra Phase 1: architecture, security and derived-data integrity
--
-- Principle: user_attempts is the candidate-owned source of truth.
-- Intelligence tables are server-derived and must not be writable from the browser.
-- Candidate data reset remains available through one ownership-checked RPC so raw
-- attempts and their derived intelligence cannot drift apart.

-- 1. Server-own all derived intelligence tables.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.readiness_dna, public.subject_dna, public.behavior_profiles,
           public.performance_profiles, public.question_dna
  FROM anon, authenticated;

-- 2. Prevent direct deletion of raw attempt history.
-- Destructive reset is routed through the ownership-checked RPC below so raw
-- attempts and derived intelligence cannot drift apart.
REVOKE DELETE ON TABLE public.user_attempts FROM anon, authenticated;

-- 3. Canonical candidate data reset.
CREATE OR REPLACE FUNCTION public.reset_candidate_training_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.readiness_dna WHERE user_id = v_user_id;
  DELETE FROM public.subject_dna WHERE user_id = v_user_id;
  DELETE FROM public.behavior_profiles WHERE user_id = v_user_id;
  DELETE FROM public.performance_profiles WHERE user_id = v_user_id;
  DELETE FROM public.active_sessions WHERE user_id = v_user_id;

  DELETE FROM public.user_attempts WHERE user_id = v_user_id;
  DELETE FROM public.bookmarks WHERE user_id = v_user_id;
  DELETE FROM public.user_notes WHERE user_id = v_user_id;
  DELETE FROM public.user_progress WHERE user_id = v_user_id;
  DELETE FROM public.study_plans WHERE user_id = v_user_id;

  UPDATE public.profiles
  SET weak_areas = NULL,
      onboarding_complete = false,
      updated_at = now()
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_candidate_training_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_candidate_training_data() TO authenticated;

-- Internal intelligence functions remain server-side only.
REVOKE ALL ON FUNCTION public.rebuild_candidate_intelligence(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_attempt_dna_on_attempt(uuid, uuid, boolean, numeric, integer, numeric, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_performance_profile_from_attempts(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_intelligence_on_attempt()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
