-- Zyntra Phase 1: keep the existing Settings data-reset path coherent.
-- The current client removes all user_attempts directly. When that final attempt
-- disappears, clear candidate-derived intelligence so it cannot outlive the source.

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
    DELETE FROM public.readiness_dna WHERE user_id = OLD.user_id;
    DELETE FROM public.subject_dna WHERE user_id = OLD.user_id;
    DELETE FROM public.behavior_profiles WHERE user_id = OLD.user_id;
    DELETE FROM public.performance_profiles WHERE user_id = OLD.user_id;
    DELETE FROM public.active_sessions WHERE user_id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_candidate_intelligence_after_reset ON public.user_attempts;
CREATE TRIGGER trg_clear_candidate_intelligence_after_reset
  AFTER DELETE ON public.user_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_candidate_intelligence_after_reset();

REVOKE ALL ON FUNCTION public.clear_candidate_intelligence_after_reset() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
