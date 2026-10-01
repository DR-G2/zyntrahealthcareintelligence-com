-- Zyntra Performance Intelligence: canonical event-derived analytics
-- One source of truth for performance/readiness analytics. Raw telemetry stays in user_attempts.
-- This migration is intentionally deterministic and does not call an external AI service.

CREATE OR REPLACE FUNCTION public.rebuild_candidate_intelligence(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
  v_correct numeric;
  v_changes numeric;
  v_avg_time numeric;
  v_stability numeric;
  v_accuracy numeric;
  v_time_score numeric;
  v_readiness numeric;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*),
         COALESCE(SUM(CASE WHEN is_correct THEN 1 ELSE 0 END), 0),
         COALESCE(SUM(answer_changes_count), 0),
         COALESCE(AVG(time_taken_seconds), 0)
    INTO v_count, v_correct, v_changes, v_avg_time
  FROM public.user_attempts
  WHERE user_id = p_user_id;

  IF v_count = 0 THEN
    INSERT INTO public.readiness_dna (
      user_id, clinical_accuracy, answer_stability, time_management,
      confidence_calibration, readiness_score, distance_from_ideal, attempt_count, updated_at
    )
    VALUES (p_user_id, 0, 0, 0, NULL, 0, NULL, 0, now())
    ON CONFLICT (user_id) DO UPDATE SET
      clinical_accuracy = 0,
      answer_stability = 0,
      time_management = 0,
      confidence_calibration = NULL,
      readiness_score = 0,
      distance_from_ideal = NULL,
      attempt_count = 0,
      updated_at = now();
    RETURN;
  END IF;

  v_accuracy := ROUND((v_correct / v_count) * 100, 2);
  v_stability := ROUND(GREATEST(0, 100 - ((v_changes / v_count) * 100)), 2);

  -- Target window from ideal_candidate_profile is 45–60 sec/question.
  v_time_score := ROUND(
    CASE
      WHEN v_avg_time BETWEEN 45 AND 60 THEN 100
      WHEN v_avg_time < 45 THEN GREATEST(0, 100 - ((45 - v_avg_time) * 1.5))
      ELSE GREATEST(0, 100 - ((v_avg_time - 60) * 1.5))
    END, 2
  );

  -- Explicit confidence telemetry is not yet stored in user_attempts.
  -- Keep calibration NULL instead of fabricating a confidence measurement.
  v_readiness := ROUND(
    v_accuracy * 0.50 +
    v_stability * 0.20 +
    v_time_score * 0.30, 2
  );

  INSERT INTO public.readiness_dna (
    user_id, clinical_accuracy, answer_stability, time_management,
    confidence_calibration, readiness_score, distance_from_ideal, attempt_count, updated_at
  )
  VALUES (
    p_user_id, v_accuracy, v_stability, v_avg_time,
    NULL, v_readiness,
    public.compute_distance_from_ideal(v_accuracy, v_stability, v_avg_time, v_accuracy),
    v_count, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    clinical_accuracy = EXCLUDED.clinical_accuracy,
    answer_stability = EXCLUDED.answer_stability,
    time_management = EXCLUDED.time_management,
    confidence_calibration = EXCLUDED.confidence_calibration,
    readiness_score = EXCLUDED.readiness_score,
    distance_from_ideal = EXCLUDED.distance_from_ideal,
    attempt_count = EXCLUDED.attempt_count,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_performance_profile_from_attempts(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r public.readiness_dna%ROWTYPE;
BEGIN
  PERFORM public.rebuild_candidate_intelligence(p_user_id);
  SELECT * INTO r FROM public.readiness_dna WHERE user_id = p_user_id;
  INSERT INTO public.performance_profiles (
    user_id, stability_score, time_sensitivity, confidence_gap, clinical_accuracy, readiness_score, updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(r.answer_stability, 0),
    CASE
      WHEN COALESCE(r.time_management, 0) BETWEEN 45 AND 60 THEN 100
      WHEN COALESCE(r.time_management, 0) < 45 THEN GREATEST(0, 100 - ((45 - r.time_management) * 1.5))
      ELSE GREATEST(0, 100 - ((r.time_management - 60) * 1.5))
    END,
    NULL,
    COALESCE(r.clinical_accuracy, 0),
    COALESCE(r.readiness_score, 0),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    stability_score = EXCLUDED.stability_score,
    time_sensitivity = EXCLUDED.time_sensitivity,
    confidence_gap = EXCLUDED.confidence_gap,
    clinical_accuracy = EXCLUDED.clinical_accuracy,
    readiness_score = EXCLUDED.readiness_score,
    updated_at = now();
END;
$$;

-- Rebuild both tables after every new attempt. Existing trigger is replaced so stale writes
-- from the legacy formula cannot silently diverge the two sources of truth.
DROP TRIGGER IF EXISTS trg_update_intelligence ON public.user_attempts;

CREATE OR REPLACE FUNCTION public.update_intelligence_on_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.rebuild_candidate_intelligence(NEW.user_id);
  PERFORM public.sync_performance_profile_from_attempts(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_intelligence
AFTER INSERT ON public.user_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_intelligence_on_attempt();
