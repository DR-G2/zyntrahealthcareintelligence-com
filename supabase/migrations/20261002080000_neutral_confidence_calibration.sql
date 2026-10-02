-- Keep a separate denominator for attempts that actually contain confidence data.
-- This prevents legacy attempts without confidence from diluting calibration.
ALTER TABLE public.readiness_dna
  ADD COLUMN IF NOT EXISTS confidence_attempt_count integer DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_intelligence_on_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_question_cat text;
  v_old_count integer := 0;
  v_old_accuracy numeric := 0;
  v_old_stability numeric := 0;
  v_old_time numeric := 0;
  v_old_calibration numeric := 50;
  v_old_conf_count integer := 0;
  v_is_stable integer;
  v_new_accuracy numeric;
  v_new_stability numeric;
  v_new_time numeric;
  v_new_calibration numeric;
  v_new_conf_count integer;
  v_calibration numeric;
  v_confidence numeric;
  v_error numeric;
  v_new_score numeric;
  v_new_distance numeric;
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
  SELECT category INTO v_question_cat FROM public.questions WHERE id = NEW.question_id;

  SELECT attempt_count, clinical_accuracy, answer_stability, time_management,
         confidence_calibration, confidence_attempt_count
  INTO v_old_count, v_old_accuracy, v_old_stability, v_old_time,
       v_old_calibration, v_old_conf_count
  FROM public.readiness_dna WHERE user_id = NEW.user_id;

  v_old_count := COALESCE(v_old_count, 0);
  v_old_accuracy := COALESCE(v_old_accuracy, 0);
  v_old_stability := COALESCE(v_old_stability, 0);
  v_old_time := COALESCE(v_old_time, 0);
  v_old_calibration := CASE WHEN v_old_conf_count > 0 THEN COALESCE(v_old_calibration, 0) ELSE 50 END;
  v_old_conf_count := COALESCE(v_old_conf_count, 0);

  v_is_stable := CASE WHEN NEW.answer_changes_count = 0 THEN 1 ELSE 0 END;
  v_new_accuracy := (v_old_accuracy * v_old_count + CASE WHEN NEW.is_correct THEN 100 ELSE 0 END) / (v_old_count + 1);
  v_new_stability := (v_old_stability * v_old_count + v_is_stable * 100) / (v_old_count + 1);
  v_new_time := (v_old_time * v_old_count + NEW.time_taken_seconds) / (v_old_count + 1);

  IF NEW.confidence_level BETWEEN 1 AND 5 THEN
    v_confidence := (NEW.confidence_level - 1) * 25;
    v_error := ABS(v_confidence - CASE WHEN NEW.is_correct THEN 100 ELSE 0 END);
    v_calibration := GREATEST(0, 100 - v_error);
    v_new_conf_count := v_old_conf_count + 1;
    v_new_calibration := (v_old_calibration * v_old_conf_count + v_calibration) / v_new_conf_count;
  ELSE
    v_new_conf_count := v_old_conf_count;
    v_new_calibration := CASE
      WHEN v_old_conf_count > 0 THEN v_old_calibration
      ELSE 50
    END;
  END IF;

  v_new_score := ROUND(
    v_new_accuracy * 0.4 +
    v_new_stability * 0.2 +
    LEAST(100, (90.0 / GREATEST(v_new_time, 1)) * 100) * 0.2 +
    v_new_calibration * 0.2, 2
  );

  v_new_distance := public.compute_distance_from_ideal(
    v_new_accuracy, v_new_stability, v_new_time, v_new_calibration
  );

  INSERT INTO public.readiness_dna (
    user_id, clinical_accuracy, answer_stability, time_management,
    confidence_calibration, confidence_attempt_count, readiness_score,
    distance_from_ideal, attempt_count, updated_at
  )
  VALUES (
    NEW.user_id, v_new_accuracy, v_new_stability, v_new_time,
    v_new_calibration, v_new_conf_count, v_new_score,
    v_new_distance, v_old_count + 1, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    clinical_accuracy = EXCLUDED.clinical_accuracy,
    answer_stability = EXCLUDED.answer_stability,
    time_management = EXCLUDED.time_management,
    confidence_calibration = EXCLUDED.confidence_calibration,
    confidence_attempt_count = EXCLUDED.confidence_attempt_count,
    readiness_score = EXCLUDED.readiness_score,
    distance_from_ideal = EXCLUDED.distance_from_ideal,
    attempt_count = EXCLUDED.attempt_count,
    updated_at = now();

  SELECT attempt_count, accuracy_rate, average_time, answer_change_rate
  INTO v_q_old_count, v_q_old_acc, v_q_old_time, v_q_old_change
  FROM public.question_dna WHERE question_id = NEW.question_id;
  IF NOT FOUND THEN
    v_q_old_count := 0; v_q_old_acc := 0; v_q_old_time := 0; v_q_old_change := 0;
  END IF;

  INSERT INTO public.question_dna (
    question_id, accuracy_rate, average_time, answer_change_rate,
    difficulty_score, attempt_count, updated_at
  )
  VALUES (
    NEW.question_id,
    (v_q_old_acc * v_q_old_count + CASE WHEN NEW.is_correct THEN 100 ELSE 0 END) / (v_q_old_count + 1),
    (v_q_old_time * v_q_old_count + NEW.time_taken_seconds) / (v_q_old_count + 1),
    (v_q_old_change * v_q_old_count + NEW.answer_changes_count) / (v_q_old_count + 1),
    100 - ((v_q_old_acc * v_q_old_count + CASE WHEN NEW.is_correct THEN 100 ELSE 0 END) / (v_q_old_count + 1)),
    v_q_old_count + 1, now()
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
    FROM public.subject_dna WHERE user_id = NEW.user_id AND subject = v_question_cat;
    IF NOT FOUND THEN
      v_s_old_count := 0; v_s_old_acc := 0; v_s_old_time := 0; v_s_old_stab := 0;
    END IF;

    v_ideal_balance := COALESCE(
      (SELECT target_value FROM public.ideal_candidate_profile WHERE metric = 'subject_balance'), 65
    );

    INSERT INTO public.subject_dna (
      user_id, subject, accuracy, attempt_count, avg_time, stability, gap_score, updated_at
    )
    VALUES (
      NEW.user_id, v_question_cat,
      (v_s_old_acc * v_s_old_count + CASE WHEN NEW.is_correct THEN 100 ELSE 0 END) / (v_s_old_count + 1),
      v_s_old_count + 1,
      (v_s_old_time * v_s_old_count + NEW.time_taken_seconds) / (v_s_old_count + 1),
      (v_s_old_stab * v_s_old_count + v_is_stable * 100) / (v_s_old_count + 1),
      GREATEST(0, v_ideal_balance - ((v_s_old_acc * v_s_old_count + CASE WHEN NEW.is_correct THEN 100 ELSE 0 END) / (v_s_old_count + 1))),
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

  SELECT COALESCE(attempt_count, 0) INTO v_bp_count
  FROM public.readiness_dna WHERE user_id = NEW.user_id;

  v_rush := CASE WHEN NEW.time_taken_seconds < 20 THEN 1 ELSE 0 END;
  v_hesitation := CASE WHEN NEW.time_taken_seconds > 120 OR COALESCE(NEW.time_to_first_click, 0) > 30 THEN 1 ELSE 0 END;
  v_fatigue := CASE WHEN COALESCE(NEW.question_position, 0) > 40 AND NOT NEW.is_correct THEN 1 ELSE 0 END;

  INSERT INTO public.behavior_profiles (
    user_id, archetype, rush_index, hesitation_index, fatigue_index, updated_at
  )
  VALUES (NEW.user_id, 'unclassified', v_rush * 100, v_hesitation * 100, v_fatigue * 100, now())
  ON CONFLICT (user_id) DO UPDATE SET
    rush_index = ROUND((COALESCE(public.behavior_profiles.rush_index, 0) * GREATEST(v_bp_count - 1, 0) + v_rush * 100) / GREATEST(v_bp_count, 1), 2),
    hesitation_index = ROUND((COALESCE(public.behavior_profiles.hesitation_index, 0) * GREATEST(v_bp_count - 1, 0) + v_hesitation * 100) / GREATEST(v_bp_count, 1), 2),
    fatigue_index = ROUND((COALESCE(public.behavior_profiles.fatigue_index, 0) * GREATEST(v_bp_count - 1, 0) + v_fatigue * 100) / GREATEST(v_bp_count, 1), 2);

  RETURN NEW;
END;
$$;


-- Existing candidates with no confidence-rated attempts should carry the same
-- neutral calibration value used by the trigger.
UPDATE public.readiness_dna
SET confidence_calibration = 50
WHERE COALESCE(confidence_attempt_count, 0) = 0;
