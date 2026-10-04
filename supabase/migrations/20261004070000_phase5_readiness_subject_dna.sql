-- Zyntra Phase 5: canonical Readiness DNA + Subject DNA
-- Readiness is a multidimensional training-readiness descriptor.
-- It is NOT a validated AMC pass probability.
-- All derived values are server-owned and candidate-scoped.

ALTER TABLE public.readiness_dna
  ADD COLUMN IF NOT EXISTS knowledge_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty_handling numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consistency_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS behavior_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_level text NOT NULL DEFAULT 'insufficient',
  ADD COLUMN IF NOT EXISTS data_quality numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_observation_at timestamptz,
  ADD COLUMN IF NOT EXISTS signal_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.subject_dna
  ADD COLUMN IF NOT EXISTS difficulty_handling numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence_calibration numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS behavior_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_level text NOT NULL DEFAULT 'insufficient',
  ADD COLUMN IF NOT EXISTS data_quality numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_observation_at timestamptz,
  ADD COLUMN IF NOT EXISTS signal_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.readiness_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_dna ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own readiness dna" ON public.readiness_dna;
CREATE POLICY "Users can view own readiness dna"
  ON public.readiness_dna FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own subject dna" ON public.subject_dna;
CREATE POLICY "Users can view own subject dna"
  ON public.subject_dna FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.readiness_dna, public.subject_dna FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_readiness_dna_user
  ON public.readiness_dna(user_id);

CREATE INDEX IF NOT EXISTS idx_subject_dna_user_subject
  ON public.subject_dna(user_id, subject);

-- Canonical full rebuild. This intentionally uses persisted attempts as the
-- source of truth and Behaviour DNA as the canonical behavioural input.
CREATE OR REPLACE FUNCTION public.rebuild_readiness_subject_dna(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_attempts integer := 0;
  v_correct numeric := 0;
  v_changed numeric := 0;
  v_avg_time numeric := 0;
  v_accuracy numeric := 0;
  v_stability numeric := 0;
  v_time_management numeric := 0;
  v_confidence numeric := 0;
  v_difficulty numeric := 0;
  v_consistency numeric := 0;
  v_behavior numeric := 0;
  v_readiness numeric := 0;
  v_quality numeric := 0;
  v_evidence text := 'insufficient';
  v_latest timestamptz;
  v_target_time numeric := 52;
  v_behavior_dna public.behavior_dna%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*)::integer,
    COALESCE(SUM(CASE WHEN is_correct THEN 1 ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN COALESCE(answer_changes_count, 0) > 0 THEN 1 ELSE 0 END), 0)::numeric,
    COALESCE(AVG(NULLIF(time_taken_seconds, 0)), 0)::numeric,
    MAX(created_at)
  INTO v_attempts, v_correct, v_changed, v_avg_time, v_latest
  FROM public.user_attempts
  WHERE user_id = p_user_id;

  SELECT COALESCE(target_value, 52)
  INTO v_target_time
  FROM public.ideal_candidate_profile
  WHERE metric = 'avg_time'
  LIMIT 1;

  IF v_attempts > 0 THEN
    v_accuracy := ROUND((v_correct / v_attempts) * 100, 2);
    v_stability := ROUND((1 - (v_changed / v_attempts)) * 100, 2);

    IF v_avg_time > 0 THEN
      v_time_management := ROUND(
        GREATEST(0, 100 - (ABS(v_avg_time - v_target_time) / GREATEST(v_target_time, 1)) * 100),
        2
      );
    END IF;

    -- Difficulty handling is deliberately transparent: difficult-question
    -- accuracy is used when enough difficult attempts exist; otherwise the
    -- overall accuracy is retained rather than fabricating a signal.
    SELECT COALESCE(
      MAX(CASE WHEN difficulty_key IN ('difficult', 'hard', '3') AND attempts >= 3 THEN accuracy END),
      MAX(CASE WHEN difficulty_key IN ('moderate', 'medium', '2') AND attempts >= 3 THEN accuracy END),
      v_accuracy
    )
    INTO v_difficulty
    FROM (
      SELECT
        COALESCE(question_difficulty_at_attempt, 'unknown') AS difficulty_key,
        COUNT(*)::integer AS attempts,
        ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END), 2) AS accuracy
      FROM public.user_attempts
      WHERE user_id = p_user_id
      GROUP BY COALESCE(question_difficulty_at_attempt, 'unknown')
    ) d;

    -- Consistency is based on dispersion of session accuracy. With fewer than
    -- two usable sessions there is no meaningful consistency signal.
    WITH session_accuracy AS (
      SELECT session_id,
             AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END) AS accuracy
      FROM public.user_attempts
      WHERE user_id = p_user_id
        AND session_id IS NOT NULL
      GROUP BY session_id
      HAVING COUNT(*) >= 3
    )
    SELECT CASE
      WHEN COUNT(*) >= 2 THEN ROUND(GREATEST(0, 100 - COALESCE(STDDEV_POP(accuracy), 0)), 2)
      ELSE 0
    END
    INTO v_consistency
    FROM session_accuracy;
  END IF;

  SELECT *
  INTO v_behavior_dna
  FROM public.behavior_dna
  WHERE user_id = p_user_id;

  IF FOUND THEN
    v_confidence := ROUND(GREATEST(0, 100 - COALESCE(v_behavior_dna.confidence_miscalibration, 0)), 2);
    v_behavior := ROUND(GREATEST(0, 100 - (
      COALESCE(v_behavior_dna.rush_index, 0)
      + COALESCE(v_behavior_dna.hesitation_index, 0)
      + COALESCE(v_behavior_dna.fatigue_index, 0)
      + COALESCE(v_behavior_dna.answer_instability_index, 0)
      + COALESCE(v_behavior_dna.premature_commitment_index, 0)
    ) / 5.0), 2);
  ELSE
    v_confidence := 0;
    v_behavior := 0;
  END IF;

  v_evidence := CASE
    WHEN v_attempts < 10 THEN 'insufficient'
    WHEN v_attempts < 30 THEN 'emerging'
    ELSE 'established'
  END;

  v_quality := ROUND(LEAST(100,
    (LEAST(v_attempts, 100)::numeric / 100) * 70
    + CASE WHEN v_behavior_dna.sample_size >= 10 THEN 15 ELSE 0 END
    + CASE WHEN v_attempts >= 10 AND v_confidence > 0 THEN 15 ELSE 0 END
  ), 2);

  -- Composite readiness is an observed training-readiness index, not a
  -- probability of passing AMC.
  IF v_attempts > 0 THEN
    v_readiness := ROUND((
      v_accuracy * 0.25
      + v_difficulty * 0.15
      + v_stability * 0.10
      + v_time_management * 0.10
      + v_confidence * 0.10
      + v_consistency * 0.10
      + v_behavior * 0.20
    ), 2);
  END IF;

  INSERT INTO public.readiness_dna (
    user_id, clinical_accuracy, answer_stability, time_management,
    confidence_calibration, readiness_score, distance_from_ideal,
    attempt_count, knowledge_score, difficulty_handling,
    consistency_score, behavior_score, confidence_score,
    evidence_level, data_quality, latest_observation_at,
    signal_version, updated_at
  )
  VALUES (
    p_user_id, v_accuracy, v_stability, v_avg_time,
    v_confidence, v_readiness,
    COALESCE(public.compute_distance_from_ideal(v_accuracy, v_stability, v_avg_time, v_confidence), 0),
    v_attempts, v_accuracy, v_difficulty, v_consistency,
    v_behavior, v_confidence, v_evidence, v_quality,
    v_latest, 1, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    clinical_accuracy = EXCLUDED.clinical_accuracy,
    answer_stability = EXCLUDED.answer_stability,
    time_management = EXCLUDED.time_management,
    confidence_calibration = EXCLUDED.confidence_calibration,
    readiness_score = EXCLUDED.readiness_score,
    distance_from_ideal = EXCLUDED.distance_from_ideal,
    attempt_count = EXCLUDED.attempt_count,
    knowledge_score = EXCLUDED.knowledge_score,
    difficulty_handling = EXCLUDED.difficulty_handling,
    consistency_score = EXCLUDED.consistency_score,
    behavior_score = EXCLUDED.behavior_score,
    confidence_score = EXCLUDED.confidence_score,
    evidence_level = EXCLUDED.evidence_level,
    data_quality = EXCLUDED.data_quality,
    latest_observation_at = EXCLUDED.latest_observation_at,
    signal_version = EXCLUDED.signal_version,
    updated_at = now();

  DELETE FROM public.subject_dna
  WHERE user_id = p_user_id;

  INSERT INTO public.subject_dna (
    user_id, subject, accuracy, attempt_count, avg_time, stability,
    gap_score, difficulty_handling, confidence_calibration,
    behavior_score, evidence_level, data_quality,
    latest_observation_at, signal_version, updated_at
  )
  SELECT
    p_user_id,
    COALESCE(qd.subject, q.category, 'unknown') AS subject,
    ROUND(AVG(CASE WHEN ua.is_correct THEN 100.0 ELSE 0.0 END), 2) AS accuracy,
    COUNT(*)::integer AS attempt_count,
    ROUND(AVG(COALESCE(ua.time_taken_seconds, 0)), 2) AS avg_time,
    ROUND((1 - AVG(CASE WHEN COALESCE(ua.answer_changes_count, 0) > 0 THEN 1.0 ELSE 0.0 END)) * 100, 2) AS stability,
    ROUND(GREATEST(0, 100 - AVG(CASE WHEN ua.is_correct THEN 100.0 ELSE 0.0 END)), 2) AS gap_score,
    ROUND(AVG(CASE
      WHEN COALESCE(ua.question_difficulty_at_attempt, '') IN ('difficult', 'hard', '3')
      THEN CASE WHEN ua.is_correct THEN 100.0 ELSE 0.0 END
      ELSE NULL
    END), 2) AS difficulty_handling,
    ROUND(AVG(CASE
      WHEN ua.confidence_level BETWEEN 1 AND 5
      THEN ABS(((ua.confidence_level - 1) * 25.0) - CASE WHEN ua.is_correct THEN 100.0 ELSE 0.0 END)
      ELSE NULL
    END), 2) AS confidence_calibration,
    ROUND(AVG(CASE WHEN COALESCE(ua.answer_changes_count, 0) > 0 THEN 0.0 ELSE 100.0 END), 2) AS behavior_score,
    CASE WHEN COUNT(*) >= 10 THEN 'emerging' ELSE 'insufficient' END,
    ROUND(LEAST(100, (LEAST(COUNT(*), 100)::numeric / 100) * 100), 2),
    MAX(ua.created_at), 1, now()
  FROM public.user_attempts ua
  JOIN public.questions q ON q.id = ua.question_id
  LEFT JOIN public.question_dna qd ON qd.question_id = ua.question_id
  WHERE ua.user_id = p_user_id
  GROUP BY COALESCE(qd.subject, q.category, 'unknown');

  -- Subjects with fewer than three attempts are retained but explicitly
  -- marked insufficient, preventing sparse data from masquerading as insight.
  UPDATE public.subject_dna
  SET evidence_level = CASE WHEN attempt_count >= 30 THEN 'established'
                            WHEN attempt_count >= 10 THEN 'emerging'
                            ELSE 'insufficient' END,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Readiness/Subject DNA refresh at completed-question/session boundaries.
-- This avoids a full aggregation on every raw user_attempts INSERT.
CREATE OR REPLACE FUNCTION public.trg_rebuild_readiness_subject_dna_on_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type IN ('QUESTION_SUBMITTED', 'SESSION_COMPLETED', 'SESSION_ABANDONED') THEN
    PERFORM public.rebuild_readiness_subject_dna(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rebuild_readiness_subject_dna_on_event ON public.behavior_events;
CREATE TRIGGER trg_rebuild_readiness_subject_dna_on_event
AFTER INSERT ON public.behavior_events
FOR EACH ROW EXECUTE FUNCTION public.trg_rebuild_readiness_subject_dna_on_event();

REVOKE ALL ON FUNCTION public.rebuild_readiness_subject_dna(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_rebuild_readiness_subject_dna_on_event() FROM PUBLIC, anon, authenticated;

-- Keep reset semantics complete.
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

NOTIFY pgrst, 'reload schema';
