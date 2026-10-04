-- Zyntra Phase 2: keep behavioural telemetry coherent with candidate reset.
-- Raw behaviour events are candidate-owned source data and must disappear with the candidate's training data.

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

  DELETE FROM public.behavior_events WHERE user_id = v_user_id;
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

CREATE OR REPLACE FUNCTION public.clear_candidate_intelligence_after_reset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_attempts WHERE user_id = OLD.user_id
  ) THEN
    DELETE FROM public.behavior_events WHERE user_id = OLD.user_id;
    DELETE FROM public.readiness_dna WHERE user_id = OLD.user_id;
    DELETE FROM public.subject_dna WHERE user_id = OLD.user_id;
    DELETE FROM public.behavior_profiles WHERE user_id = OLD.user_id;
    DELETE FROM public.performance_profiles WHERE user_id = OLD.user_id;
    DELETE FROM public.active_sessions WHERE user_id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_candidate_intelligence_after_reset() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
