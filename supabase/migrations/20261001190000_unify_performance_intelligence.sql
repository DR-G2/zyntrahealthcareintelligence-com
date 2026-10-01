-- Zyntra Performance Intelligence: canonical event-derived analytics
-- Raw attempt telemetry remains the source data. Derived tables are rebuilt from it.
-- This migration keeps the existing question/subject/behaviour telemetry updates intact.

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
    NULL, v_readiness, v_distance, v_count, now()
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

CREATE OR REPLACE FUNCTION public.update_attempt_dna_on_attempt(p_user_id uuid, p_question_id uuid, p_is_correct boolean, p_time_taken numeric, p_answer_changes integer, p_time_to_first_click numeric, p_question_position integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_question_cat text;
  v_is_stable integer;
  v_q_old_count integer;
  v_q_old_acc numeric;
  v_q_old_time numeric;
  v_q_old_change numeric;
  v_s_old_count integer;
  v_s_old_acc numeric;
  v_s_old_time numeric;
  v_s_old_stab numeric;
  v_ideal_balance numeric;
  v_rush numeric;
  v_hesitation numeric;
  v_fatigue numeric;
  v_bp_count integer;
BEGIN
  SELECT category INTO v_question_cat
  FROM public.questions
  WHERE id = p_question_id;

  v_is_stable := CASE WHEN COALESCE(p_answer_changes, 0) = 0 THEN 1 ELSE 0 END;

  SELECT attempt_count, accuracy_rate, average_time, answer_change_rate
    INTO v_q_old_count, v_q_old_acc, v_q_old_time, v_q_old_change
  FROM public.question_dna
  WHERE question_id = p_question_id;

  IF NOT FOUND THEN
    v_q_old_count := 0; v_q_old_acc := 0; v_q_old_time := 0; v_q_old_change := 0;
  END IF;

  INSERT INTO public.question_dna (
    question_id, accuracy_rate, average_time, answer_change_rate, difficulty_score, attempt_count, updated_at
  )
  VALUES (
    p_question_id,
    (v_q_old_acc * v_q_old_count + CASE WHEN p_is_correct THEN 100 ELSE 0 END) / (v_q_old_count + 1),
    (v_q_old_time * v_q_old_count + COALESCE(p_time_taken, 0)) / (v_q_old_count + 1),
    (v_q_old_change * v_q_old_count + COALESCE(p_answer_changes, 0)) / (v_q_old_count + 1),
    100 - ((v_q_old_acc * v_q_old_count + CASE WHEN p_is_correct THEN 100 ELSE 0 END) / (v_q_old_count + 1)),
    v_q_old_count + 1,
    now()
  )
  ON CONFLICT (question_id) DO UPDATE SET
    accuracy_rate = EXCLUDED.accuracy_rate,
    average_time = EXCLUDED.average_time,
    answer_change_rate = EXCLUDED.answer_change_rate,
    difficulty_score = EXCLUDED.difficulty_score,
    attempt_count = EXCLUDED.attempt_count,
    updated_at = now();

  IF v_question_cat IS NOT NULL THEN
    SELECT attempt_count, accuracy, avg_time, stability
      INTO v_s_old_count, v_s_old_acc, v_s_old_time, v_s_old_stab
    FROM public.subject_dna
    WHERE user_id = p_user_id AND subject = v_question_cat;

    IF NOT FOUND THEN
      v_s_old_count := 0; v_s_old_acc := 0; v_s_old_time := 0; v_s_old_stab := 0;
    END IF;

    v_ideal_balance := COALESCE(
      (SELECT target_value FROM public.ideal_candidate_profile WHERE metric = 'subject_balance'),
      65
    );

    INSERT INTO public.subject_dna (
      user_id, subject, accuracy, attempt_count, avg_time, stability, gap_score, updated_at
    )
    VALUES (
      p_user_id,
      v_question_cat,
      (v_s_old_acc * v_s_old_count + CASE WHEN p_is_correct THEN 100 ELSE 0 END) / (v_s_old_count + 1),
      v_s_old_count + 1,
      (v_s_old_time * v_s_old_count + COALESCE(p_time_taken, 0)) / (v_s_old_count + 1),
      (v_s_old_stab * v_s_old_count + v_is_stable * 100) / (v_s_old_count + 1),
      GREATEST(0, v_ideal_balance - ((v_s_old_acc * v_s_old_count + CASE WHEN p_is_correct THEN 100 ELSE 0 END) / (v_s_old_count + 1))),
      now()
    )
    ON CONFLICT (user_id, subject) DO UPDATE SET
      accuracy = EXCLUDED.accuracy,
      attempt_count = EXCLUDED.attempt_count,
      avg_time = EXCLUDED.avg_time,
      stability = EXCLUDED.stability,
      gap_score = EXCLUDED.gap_score,
      updated_at = now();
  END IF;

  SELECT COALESCE(attempt_count, 0)
    INTO v_bp_count
  FROM public.readiness_dna
  WHERE user_id = p_user_id;

  v_rush := CASE WHEN COALESCE(p_time_taken, 0) < 20 THEN 1 ELSE 0 END;
  v_hesitation := CASE
    WHEN COALESCE(p_time_taken, 0) > 120 OR COALESCE(p_time_to_first_click, 0) > 30 THEN 1
    ELSE 0
  END;
  v_fatigue := CASE
    WHEN COALESCE(p_question_position, 0) > 40 AND NOT p_is_correct THEN 1
    ELSE 0
  END;

  INSERT INTO public.behavior_profiles (
    user_id, archetype, rush_index, hesitation_index, fatigue_index, updated_at
  )
  VALUES (
    p_user_id, 'unclassified', v_rush * 100, v_hesitation * 100, v_fatigue * 100, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    rush_index = ROUND(
      (COALESCE(public.behavior_profiles.rush_index, 0) * GREATEST(v_bp_count - 1, 0) + v_rush * 100)
      / GREATEST(v_bp_count, 1), 2
    ),
    hesitation_index = ROUND(
      (COALESCE(public.behavior_profiles.hesitation_index, 0) * GREATEST(v_bp_count - 1, 0) + v_hesitation * 100)
      / GREATEST(v_bp_count, 1), 2
    ),
    fatigue_index = ROUND(
      (COALESCE(public.behavior_profiles.fatigue_index, 0) * GREATEST(v_bp_count - 1, 0) + v_fatigue * 100)
      / GREATEST(v_bp_count, 1), 2
    ),
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
  v_time_score numeric;
BEGIN
  SELECT * INTO r FROM public.readiness_dna WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_time_score := CASE
    WHEN r.time_management BETWEEN 45 AND 60 THEN 100
    WHEN r.time_management < 45 THEN GREATEST(0, 100 - ((45 - r.time_management) * 1.5))
    ELSE GREATEST(0, 100 - ((r.time_management - 60) * 1.5))
  END;

  INSERT INTO public.performance_profiles (
    user_id, stability_score, time_sensitivity, confidence_gap,
    clinical_accuracy, readiness_score, updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(r.answer_stability, 0),
    v_time_score,
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

DROP TRIGGER IF EXISTS trg_update_intelligence ON public.user_attempts;

CREATE OR REPLACE FUNCTION public.update_intelligence_on_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.rebuild_candidate_intelligence(NEW.user_id);
  PERFORM public.update_attempt_dna_on_attempt(
    NEW.user_id,
    NEW.question_id,
    NEW.is_correct,
    NEW.time_taken_seconds,
    NEW.answer_changes_count,
    NEW.time_to_first_click,
    NEW.question_position
  );
  PERFORM public.sync_performance_profile_from_attempts(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_intelligence
AFTER INSERT ON public.user_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_intelligence_on_attempt();
