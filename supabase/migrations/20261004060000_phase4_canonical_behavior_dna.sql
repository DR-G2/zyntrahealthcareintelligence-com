-- Zyntra Phase 4: canonical Behaviour DNA
-- Behaviour DNA is a deterministic training-behaviour descriptor derived from
-- immutable behaviour_events + candidate attempts. It is not a personality,
-- mental-health, or exam-pass prediction model.

CREATE TABLE IF NOT EXISTS public.behavior_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  sample_size integer NOT NULL DEFAULT 0,
  evidence_level text NOT NULL DEFAULT 'insufficient',
  data_quality numeric NOT NULL DEFAULT 0,
  rush_index numeric NOT NULL DEFAULT 0,
  hesitation_index numeric NOT NULL DEFAULT 0,
  fatigue_index numeric NOT NULL DEFAULT 0,
  answer_instability_index numeric NOT NULL DEFAULT 0,
  premature_commitment_index numeric NOT NULL DEFAULT 0,
  rule_out_rate numeric NOT NULL DEFAULT 0,
  confidence_miscalibration numeric NOT NULL DEFAULT 0,
  first_instinct_accuracy numeric,
  correct_to_wrong_change_rate numeric,
  difficulty_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
  subject_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
  latest_observation_at timestamptz,
  signal_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.behavior_dna ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own behavior dna" ON public.behavior_dna;
CREATE POLICY "Users can view own behavior dna"
  ON public.behavior_dna FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.behavior_dna FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_behavior_dna_user
  ON public.behavior_dna(user_id);

CREATE OR REPLACE FUNCTION public.rebuild_behavior_dna(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempt_count integer := 0;
  v_changed_count integer := 0;
  v_first_instinct_correct integer := 0;
  v_correct_to_wrong integer := 0;
  v_rush numeric := 0;
  v_hesitation numeric := 0;
  v_fatigue numeric := 0;
  v_instability numeric := 0;
  v_premature numeric := 0;
  v_rule_out numeric := 0;
  v_confidence_miscalibration numeric := 0;
  v_confidence_count integer := 0;
  v_rule_out_questions integer := 0;
  v_latest timestamptz;
  v_evidence text;
  v_quality numeric;
  v_first_instinct numeric;
  v_correct_to_wrong_rate numeric;
  v_difficulty jsonb := '{}'::jsonb;
  v_subject jsonb := '{}'::jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE COALESCE(answer_changes_count, 0) > 0)::integer,
    MAX(created_at)
  INTO v_attempt_count, v_changed_count, v_latest
  FROM public.user_attempts
  WHERE user_id = p_user_id;

  IF v_attempt_count > 0 THEN
    SELECT
      COALESCE(AVG(CASE WHEN COALESCE(time_taken_seconds, 0) <= 45 THEN 100.0 ELSE 0.0 END), 0),
      COALESCE(AVG(CASE WHEN COALESCE(time_taken_seconds, 0) >= 180 THEN 100.0 ELSE 0.0 END), 0),
      COALESCE(AVG(LEAST(100.0, (COALESCE(answer_changes_count, 0) / 2.0) * 100.0)), 0),
      COALESCE(AVG(CASE WHEN COALESCE(time_to_first_click, 999999) <= 5 THEN 100.0 ELSE 0.0 END), 0)
    INTO v_rush, v_hesitation, v_instability, v_premature
    FROM public.user_attempts
    WHERE user_id = p_user_id;

    WITH session_stats AS (
      SELECT
        session_id,
        AVG(time_taken_seconds) FILTER (WHERE question_position <= COALESCE(max_pos, 0) / 2.0) AS early_avg,
        AVG(time_taken_seconds) FILTER (WHERE question_position > COALESCE(max_pos, 0) / 2.0) AS late_avg
      FROM (
        SELECT
          ua.*,
          MAX(question_position) OVER (PARTITION BY session_id) AS max_pos
        FROM public.user_attempts ua
        WHERE ua.user_id = p_user_id
      ) s
      GROUP BY session_id
    )
    SELECT COALESCE(AVG(
      LEAST(100.0, GREATEST(0.0,
        ((late_avg - early_avg) / NULLIF(early_avg, 0)) * 100.0
      ))
    ), 0)
    INTO v_fatigue
    FROM session_stats
    WHERE early_avg IS NOT NULL AND late_avg IS NOT NULL AND early_avg > 0;

    SELECT
      COUNT(*) FILTER (
        WHERE COALESCE(answer_changes_count, 0) > 0
          AND jsonb_typeof(change_sequence) = 'array'
          AND jsonb_array_length(change_sequence) > 0
          AND change_sequence->>0 = questions.correct_answer
      )::integer,
      COUNT(*) FILTER (
        WHERE COALESCE(answer_changes_count, 0) > 0
          AND jsonb_typeof(change_sequence) = 'array'
          AND jsonb_array_length(change_sequence) > 0
          AND change_sequence->>0 = questions.correct_answer
          AND selected_answer <> questions.correct_answer
      )::integer
    INTO v_first_instinct_correct, v_correct_to_wrong
    FROM public.user_attempts ua
    JOIN public.questions ON questions.id = ua.question_id
    WHERE ua.user_id = p_user_id;

    SELECT COUNT(*)
    INTO v_confidence_count
    FROM public.user_attempts
    WHERE user_id = p_user_id
      AND confidence_level BETWEEN 1 AND 5;

    IF v_confidence_count > 0 THEN
      SELECT COALESCE(AVG(
        ABS(
          ((confidence_level - 1) * 25.0)
          - CASE WHEN is_correct THEN 100.0 ELSE 0.0 END
        )
      ), 0)
      INTO v_confidence_miscalibration
      FROM public.user_attempts
      WHERE user_id = p_user_id
        AND confidence_level BETWEEN 1 AND 5;
    END IF;

    IF v_changed_count > 0 THEN
      v_first_instinct := ROUND((v_first_instinct_correct::numeric / v_changed_count) * 100, 2);
      v_correct_to_wrong_rate := ROUND((v_correct_to_wrong::numeric / v_changed_count) * 100, 2);
    ELSE
      v_first_instinct := NULL;
      v_correct_to_wrong_rate := NULL;
    END IF;

    SELECT COUNT(DISTINCT (session_id, question_id))
    INTO v_rule_out_questions
    FROM public.behavior_events
    WHERE user_id = p_user_id
      AND event_type = 'OPTION_RULED_OUT'
      AND question_id IS NOT NULL;

    IF v_attempt_count > 0 THEN
      v_rule_out := ROUND(LEAST(100.0, (v_rule_out_questions::numeric / v_attempt_count) * 100), 2);
    END IF;

    SELECT COALESCE(jsonb_object_agg(
      COALESCE(difficulty_key, 'unknown'),
      jsonb_build_object(
        'attempts', attempts,
        'accuracy', accuracy,
        'avg_time_seconds', avg_time_seconds,
        'change_rate', change_rate
      )
    ), '{}'::jsonb)
    INTO v_difficulty
    FROM (
      SELECT
        COALESCE(question_difficulty_at_attempt, 'unknown') AS difficulty_key,
        COUNT(*)::integer AS attempts,
        ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END), 2) AS accuracy,
        ROUND(AVG(COALESCE(time_taken_seconds, 0)), 2) AS avg_time_seconds,
        ROUND(AVG(LEAST(100.0, COALESCE(answer_changes_count, 0) * 100.0)), 2) AS change_rate
      FROM public.user_attempts
      WHERE user_id = p_user_id
      GROUP BY COALESCE(question_difficulty_at_attempt, 'unknown')
    ) d;

    SELECT COALESCE(jsonb_object_agg(
      COALESCE(subject_key, 'unknown'),
      jsonb_build_object(
        'attempts', attempts,
        'accuracy', accuracy,
        'avg_time_seconds', avg_time_seconds,
        'change_rate', change_rate,
        'evidence', CASE WHEN attempts >= 10 THEN 'emerging' ELSE 'insufficient' END
      )
    ), '{}'::jsonb)
    INTO v_subject
    FROM (
      SELECT
        COALESCE(qd.subject, q.category, 'unknown') AS subject_key,
        COUNT(*)::integer AS attempts,
        ROUND(AVG(CASE WHEN ua.is_correct THEN 100.0 ELSE 0.0 END), 2) AS accuracy,
        ROUND(AVG(COALESCE(ua.time_taken_seconds, 0)), 2) AS avg_time_seconds,
        ROUND(AVG(LEAST(100.0, COALESCE(ua.answer_changes_count, 0) * 100.0)), 2) AS change_rate
      FROM public.user_attempts ua
      JOIN public.questions q ON q.id = ua.question_id
      LEFT JOIN public.question_dna qd ON qd.question_id = ua.question_id
      WHERE ua.user_id = p_user_id
      GROUP BY COALESCE(qd.subject, q.category, 'unknown')
    ) s;
  END IF;

  v_evidence := CASE
    WHEN v_attempt_count < 10 THEN 'insufficient'
    WHEN v_attempt_count < 30 THEN 'emerging'
    ELSE 'established'
  END;

  v_quality := ROUND(LEAST(100.0,
    (LEAST(v_attempt_count, 100)::numeric / 100.0) * 70.0
    + CASE WHEN v_changed_count > 0 THEN 15 ELSE 0 END
    + CASE WHEN v_confidence_count > 0 THEN 15 ELSE 0 END
  ), 2);

  INSERT INTO public.behavior_dna (
    user_id, sample_size, evidence_level, data_quality,
    rush_index, hesitation_index, fatigue_index,
    answer_instability_index, premature_commitment_index,
    rule_out_rate, confidence_miscalibration,
    first_instinct_accuracy, correct_to_wrong_change_rate,
    difficulty_behavior, subject_behavior,
    latest_observation_at, signal_version, updated_at
  )
  VALUES (
    p_user_id, v_attempt_count, v_evidence, v_quality,
    ROUND(v_rush, 2), ROUND(v_hesitation, 2), ROUND(v_fatigue, 2),
    ROUND(v_instability, 2), ROUND(v_premature, 2),
    ROUND(v_rule_out, 2), ROUND(v_confidence_miscalibration, 2),
    v_first_instinct, v_correct_to_wrong_rate,
    v_difficulty, v_subject,
    v_latest, 1, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    sample_size = EXCLUDED.sample_size,
    evidence_level = EXCLUDED.evidence_level,
    data_quality = EXCLUDED.data_quality,
    rush_index = EXCLUDED.rush_index,
    hesitation_index = EXCLUDED.hesitation_index,
    fatigue_index = EXCLUDED.fatigue_index,
    answer_instability_index = EXCLUDED.answer_instability_index,
    premature_commitment_index = EXCLUDED.premature_commitment_index,
    rule_out_rate = EXCLUDED.rule_out_rate,
    confidence_miscalibration = EXCLUDED.confidence_miscalibration,
    first_instinct_accuracy = EXCLUDED.first_instinct_accuracy,
    correct_to_wrong_change_rate = EXCLUDED.correct_to_wrong_change_rate,
    difficulty_behavior = EXCLUDED.difficulty_behavior,
    subject_behavior = EXCLUDED.subject_behavior,
    latest_observation_at = EXCLUDED.latest_observation_at,
    signal_version = EXCLUDED.signal_version,
    updated_at = now();
END;
$$;

-- Refresh is intentionally lifecycle-bound rather than per-attempt.\n-- This prevents a full candidate-wide aggregation on every INSERT.\n-- Event telemetry is the source for decision-level signals such as rule-out behaviour.
-- Recompute only on lifecycle events that represent a completed question/session.
-- QUESTION_SUBMITTED is the primary refresh boundary; session lifecycle events provide
-- a fallback for abandoned/completed sessions.
CREATE OR REPLACE FUNCTION public.trg_rebuild_behavior_dna_on_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type IN ('QUESTION_SUBMITTED', 'SESSION_COMPLETED', 'SESSION_ABANDONED') THEN
    PERFORM public.rebuild_behavior_dna(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rebuild_behavior_dna_on_event ON public.behavior_events;
CREATE TRIGGER trg_rebuild_behavior_dna_on_event
AFTER INSERT ON public.behavior_events
FOR EACH ROW EXECUTE FUNCTION public.trg_rebuild_behavior_dna_on_event();

-- Reset semantics: raw telemetry and all derived Behaviour DNA must disappear together.
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
  DELETE FROM public.behavior_dna WHERE user_id = v_user_id;
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
REVOKE ALL ON FUNCTION public.rebuild_behavior_dna(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_rebuild_behavior_dna_on_event() FROM PUBLIC, anon, authenticated;

-- If the last attempt is deleted outside the explicit reset RPC, remove derived DNA.
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
    DELETE FROM public.behavior_dna WHERE user_id = OLD.user_id;
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
