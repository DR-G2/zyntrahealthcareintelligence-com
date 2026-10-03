-- Canonical intelligence consistency hardening
-- Rebuilds must not erase confidence calibration after the canonical confidence migration.
-- Confidence is recomputed from the candidate's own attempts on every intelligence rebuild.
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
  v_distance numeric;
  v_confidence_calibration numeric;
  v_confidence_attempt_count integer;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*),
         COALESCE(SUM(CASE WHEN is_correct THEN 1 ELSE 0 END), 0),
         COALESCE(SUM(answer_changes_count), 0),
         COALESCE(AVG(time_taken_seconds), 0)
    INTO v_count, v_correct, v_changes, v_avg_time
  FROM public.user_attempts
  WHERE user_id = p_user_id;

  SELECT
    COUNT(*)::integer,
    AVG(
      GREATEST(
        0,
        100 - ABS(
          ((confidence_level - 1) * 25.0)
          - CASE WHEN is_correct THEN 100.0 ELSE 0.0 END
        )
      )
    )
  INTO v_confidence_attempt_count, v_confidence_calibration
  FROM public.user_attempts
  WHERE user_id = p_user_id
    AND confidence_level BETWEEN 1 AND 5;

  IF v_count = 0 THEN
    INSERT INTO public.readiness_dna (
      user_id, clinical_accuracy, answer_stability, time_management,
      confidence_calibration, readiness_score, distance_from_ideal, attempt_count, updated_at
    )
    VALUES (
      p_user_id, 0, 0, 0,
      COALESCE(v_confidence_calibration, 50),
      0, NULL, 0, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      clinical_accuracy = 0,
      answer_stability = 0,
      time_management = 0,
      confidence_calibration = COALESCE(v_confidence_calibration, 50),
      readiness_score = 0,
      distance_from_ideal = NULL,
      attempt_count = 0,
      updated_at = now();
    RETURN;
  END IF;

  v_accuracy := ROUND((v_correct / v_count) * 100, 2);
  v_stability := ROUND(GREATEST(0, 100 - ((v_changes / v_count) * 100)), 2);

  -- Ideal timing window: 45–60 seconds, target 52 seconds.
  v_time_score := ROUND(
    CASE
      WHEN v_avg_time BETWEEN 45 AND 60 THEN 100
      WHEN v_avg_time < 45 THEN GREATEST(0, 100 - ((45 - v_avg_time) * 1.5))
      ELSE GREATEST(0, 100 - ((v_avg_time - 60) * 1.5))
    END, 2
  );

  -- No confidence field exists in user_attempts yet. Do not fabricate calibration.
  v_readiness := ROUND(
    v_accuracy * 0.50 +
    v_stability * 0.20 +
    v_time_score * 0.30, 2
  );

  v_distance := NULL;

  INSERT INTO public.readiness_dna (
    user_id, clinical_accuracy, answer_stability, time_management,
    confidence_calibration, readiness_score, distance_from_ideal, attempt_count, updated_at
  )
  VALUES (
    p_user_id, v_accuracy, v_stability, v_avg_time,
    COALESCE(v_confidence_calibration, 50), v_readiness, v_distance, v_count, now()
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
