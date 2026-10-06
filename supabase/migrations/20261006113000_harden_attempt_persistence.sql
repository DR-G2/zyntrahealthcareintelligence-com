-- Harden attempt persistence.
-- The user's answer is the source of truth. If a downstream intelligence
-- calculation encounters a schema/data problem, the attempt must still save.

ALTER TABLE public.user_attempts
  ADD COLUMN IF NOT EXISTS confidence_level integer,
  ADD COLUMN IF NOT EXISTS question_difficulty_at_attempt text,
  ADD COLUMN IF NOT EXISTS question_dna_version_at_attempt integer,
  ADD COLUMN IF NOT EXISTS time_to_first_click integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_sequence jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pause_events integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_of_day timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS question_position integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_question_correct boolean;

ALTER TABLE public.user_attempts
  DROP CONSTRAINT IF EXISTS user_attempts_confidence_level_check;

ALTER TABLE public.user_attempts
  ADD CONSTRAINT user_attempts_confidence_level_check
  CHECK (confidence_level IS NULL OR confidence_level BETWEEN 1 AND 5);

CREATE OR REPLACE FUNCTION public.update_intelligence_on_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_question_cat text;
  v_old_count integer;
  v_old_accuracy numeric;
  v_old_stability numeric;
  v_old_time numeric;
  v_is_stable integer;
  v_new_accuracy numeric;
  v_new_stability numeric;
  v_new_time numeric;
  v_new_calibration numeric;
  v_new_score numeric;
  v_new_distance numeric;
  -- question dna vars
  v_q_old_count integer;
  v_q_old_acc numeric;
  v_q_old_time numeric;
  v_q_old_change numeric;
  -- subject dna vars
  v_s_old_count integer;
  v_s_old_acc numeric;
  v_s_old_time numeric;
  v_s_old_stab numeric;
  v_ideal_balance numeric;
BEGIN
  -- Get question category
  SELECT category INTO v_question_cat FROM public.questions WHERE id = NEW.question_id;

  -- ═══ UPDATE readiness_dna ═══
  SELECT attempt_count, clinical_accuracy, answer_stability, time_management
    INTO v_old_count, v_old_accuracy, v_old_stability, v_old_time
    FROM public.readiness_dna WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    v_old_count := 0; v_old_accuracy := 0; v_old_stability := 0; v_old_time := 0;
  END IF;

  v_is_stable := CASE WHEN NEW.answer_changes_count = 0 THEN 1 ELSE 0 END;
  v_new_accuracy := (v_old_accuracy * v_old_count + CASE WHEN NEW.is_correct THEN 100 ELSE 0 END) / (v_old_count + 1);
  v_new_stability := (v_old_stability * v_old_count + v_is_stable * 100) / (v_old_count + 1);
  v_new_time := (v_old_time * v_old_count + NEW.time_taken_seconds) / (v_old_count + 1);
  -- Confidence calibration: simplified as accuracy for now (no confidence_level field)
  v_new_calibration := v_new_accuracy;

  v_new_score := ROUND(v_new_accuracy * 0.4 + v_new_stability * 0.2 + LEAST(100, (90.0 / GREATEST(v_new_time, 1)) * 100) * 0.2 + v_new_calibration * 0.2, 2);
  v_new_distance := public.compute_distance_from_ideal(v_new_accuracy, v_new_stability, v_new_time, v_new_calibration);

  INSERT INTO public.readiness_dna (user_id, clinical_accuracy, answer_stability, time_management, confidence_calibration, readiness_score, distance_from_ideal, attempt_count, updated_at)
  VALUES (NEW.user_id, v_new_accuracy, v_new_stability, v_new_time, v_new_calibration, v_new_score, v_new_distance, v_old_count + 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    clinical_accuracy = EXCLUDED.clinical_accuracy,
    answer_stability = EXCLUDED.answer_stability,
    time_management = EXCLUDED.time_management,
    confidence_calibration = EXCLUDED.confidence_calibration,
    readiness_score = EXCLUDED.readiness_score,
    distance_from_ideal = EXCLUDED.distance_from_ideal,
    attempt_count = EXCLUDED.attempt_count,
    updated_at = now();

  -- ═══ UPDATE question_dna ═══
  SELECT attempt_count, accuracy_rate, average_time, answer_change_rate
    INTO v_q_old_count, v_q_old_acc, v_q_old_time, v_q_old_change
    FROM public.question_dna WHERE question_id = NEW.question_id;

  IF NOT FOUND THEN
    v_q_old_count := 0; v_q_old_acc := 0; v_q_old_time := 0; v_q_old_change := 0;
  END IF;

  INSERT INTO public.question_dna (question_id, accuracy_rate, average_time, answer_change_rate, difficulty_score, attempt_count, updated_at)
  VALUES (
    NEW.question_id,
    (v_q_old_acc * v_q_old_count + CASE WHEN NEW.is_correct THEN 100 ELSE 0 END) / (v_q_old_count + 1),
    (v_q_old_time * v_q_old_count + NEW.time_taken_seconds) / (v_q_old_count + 1),
    (v_q_old_change * v_q_old_count + NEW.answer_changes_count) / (v_q_old_count + 1),
    100 - ((v_q_old_acc * v_q_old_count + CASE WHEN NEW.is_correct THEN 100 ELSE 0 END) / (v_q_old_count + 1)),
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

  -- ═══ UPDATE subject_dna ═══
  IF v_question_cat IS NOT NULL THEN
    SELECT attempt_count, accuracy, avg_time, stability
      INTO v_s_old_count, v_s_old_acc, v_s_old_time, v_s_old_stab
      FROM public.subject_dna WHERE user_id = NEW.user_id AND subject = v_question_cat;

    IF NOT FOUND THEN
      v_s_old_count := 0; v_s_old_acc := 0; v_s_old_time := 0; v_s_old_stab := 0;
    END IF;

    v_ideal_balance := COALESCE((SELECT target_value FROM public.ideal_candidate_profile WHERE metric = 'subject_balance'), 65);

    INSERT INTO public.subject_dna (user_id, subject, accuracy, attempt_count, avg_time, stability, gap_score, updated_at)
    VALUES (
      NEW.user_id,
      v_question_cat,
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

  -- ═══ UPDATE behavior_profiles (rush/hesitation/fatigue indices) ═══
  -- Rush: time < 20s, Hesitation: time > 120s or first_click > 30s, Fatigue: position > 40
  DECLARE
    v_rush numeric;
    v_hesitation numeric;
    v_fatigue numeric;
    v_bp_count integer;
  BEGIN
    SELECT COALESCE(attempt_count, 0) INTO v_bp_count FROM public.readiness_dna WHERE user_id = NEW.user_id;

    v_rush := CASE WHEN NEW.time_taken_seconds < 20 THEN 1 ELSE 0 END;
    v_hesitation := CASE WHEN NEW.time_taken_seconds > 120 OR COALESCE(NEW.time_to_first_click, 0) > 30 THEN 1 ELSE 0 END;
    v_fatigue := CASE WHEN COALESCE(NEW.question_position, 0) > 40 AND NOT NEW.is_correct THEN 1 ELSE 0 END;

    INSERT INTO public.behavior_profiles (
      user_id, archetype, rush_index, hesitation_index, fatigue_index, updated_at
    )
    VALUES (
      NEW.user_id,
      'unclassified',
      v_rush * 100,
      v_hesitation * 100,
      v_fatigue * 100,
      now()
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

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Attempt persistence is authoritative. Intelligence calculations must never
    -- prevent the candidate's answer from being saved.
    RAISE WARNING '[Zyntra] intelligence trigger skipped: %', SQLERRM;
    RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS trg_update_intelligence ON public.user_attempts;
CREATE TRIGGER trg_update_intelligence
  AFTER INSERT ON public.user_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_intelligence_on_attempt();

NOTIFY pgrst, 'reload schema';
