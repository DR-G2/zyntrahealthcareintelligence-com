-- Zyntra Phase 2A: P0 intelligence foundation repair
-- Canonicalizes candidate readiness/confidence and deterministic behavioural indices.
-- Safe to run after any earlier intelligence migrations.

-- 1. Candidate-owned raw telemetry.
CREATE TABLE IF NOT EXISTS public.behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'QUESTION_OPENED','QUESTION_FIRST_INTERACTION','ANSWER_SELECTED',
      'ANSWER_CHANGED','CONFIDENCE_SET','QUESTION_SUBMITTED',
      'SESSION_STARTED','SESSION_RESUMED','SESSION_COMPLETED',
      'SESSION_ABANDONED','SESSION_PAUSED','INTERVENTION_STARTED',
      'INTERVENTION_COMPLETED','INTERVENTION_OUTCOME'
    )
  ),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sequence_no INTEGER,
  question_position INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_behavior_events_user_time
  ON public.behavior_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_session
  ON public.behavior_events (user_id, session_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_behavior_events_question
  ON public.behavior_events (user_id, question_id, occurred_at DESC);

ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own behavior events" ON public.behavior_events;
CREATE POLICY "Users can view own behavior events"
  ON public.behavior_events FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own behavior events" ON public.behavior_events;
CREATE POLICY "Users can insert own behavior events"
  ON public.behavior_events FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

REVOKE UPDATE, DELETE, TRUNCATE ON public.behavior_events FROM anon, authenticated;

-- 2. Confidence data needs its own denominator.
ALTER TABLE public.readiness_dna
  ADD COLUMN IF NOT EXISTS confidence_attempt_count INTEGER NOT NULL DEFAULT 0;

-- 3. Canonical readiness rebuild from candidate-owned attempts.
CREATE OR REPLACE FUNCTION public.rebuild_candidate_intelligence(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
  v_correct NUMERIC;
  v_changes NUMERIC;
  v_avg_time NUMERIC;
  v_accuracy NUMERIC;
  v_stability NUMERIC;
  v_time_score NUMERIC;
  v_calibration NUMERIC;
  v_conf_count INTEGER;
  v_readiness NUMERIC;
  v_distance NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(CASE WHEN is_correct THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(answer_changes_count), 0),
    COALESCE(AVG(time_taken_seconds), 0)
  INTO v_count, v_correct, v_changes, v_avg_time
  FROM public.user_attempts
  WHERE user_id = p_user_id;

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(AVG(
      GREATEST(
        0,
        100 - ABS(
          ((confidence_level - 1) * 25.0)
          - CASE WHEN is_correct THEN 100.0 ELSE 0.0 END
        )
      )
    ), 50)
  INTO v_conf_count, v_calibration
  FROM public.user_attempts
  WHERE user_id = p_user_id
    AND confidence_level BETWEEN 1 AND 5;

  IF v_count = 0 THEN
    INSERT INTO public.readiness_dna (
      user_id, clinical_accuracy, answer_stability, time_management,
      confidence_calibration, confidence_attempt_count, readiness_score,
      distance_from_ideal, attempt_count, updated_at
    )
    VALUES (
      p_user_id, 0, 0, 0, COALESCE(v_calibration, 50),
      COALESCE(v_conf_count, 0), 0, NULL, 0, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      clinical_accuracy = 0,
      answer_stability = 0,
      time_management = 0,
      confidence_calibration = EXCLUDED.confidence_calibration,
      confidence_attempt_count = EXCLUDED.confidence_attempt_count,
      readiness_score = 0,
      distance_from_ideal = NULL,
      attempt_count = 0,
      updated_at = now();
    RETURN;
  END IF;

  v_accuracy := ROUND((v_correct / v_count) * 100, 2);
  v_stability := ROUND(GREATEST(0, 100 - ((v_changes / v_count) * 100)), 2);
  v_time_score := ROUND(LEAST(100, (90.0 / GREATEST(v_avg_time, 1)) * 100), 2);

  -- Four inspectable training dimensions. This is NOT an AMC pass prediction.
  v_readiness := ROUND(
    v_accuracy * 0.40 +
    v_stability * 0.20 +
    v_time_score * 0.20 +
    COALESCE(v_calibration, 50) * 0.20,
    2
  );

  v_distance := public.compute_distance_from_ideal(
    v_accuracy, v_stability, v_avg_time, COALESCE(v_calibration, 50)
  );

  INSERT INTO public.readiness_dna (
    user_id, clinical_accuracy, answer_stability, time_management,
    confidence_calibration, confidence_attempt_count, readiness_score,
    distance_from_ideal, attempt_count, updated_at
  )
  VALUES (
    p_user_id, v_accuracy, v_stability, v_avg_time,
    COALESCE(v_calibration, 50), COALESCE(v_conf_count, 0),
    v_readiness, v_distance, v_count, now()
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
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_candidate_intelligence(UUID)
  FROM PUBLIC, anon, authenticated;

-- 4. Deterministic behavioural indices from observable attempt telemetry.
CREATE OR REPLACE FUNCTION public.rebuild_candidate_behavior_profile(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rush NUMERIC;
  v_hesitation NUMERIC;
  v_fatigue NUMERIC;
  v_total INTEGER;
  v_recent_accuracy NUMERIC;
  v_prior_accuracy NUMERIC;
  v_recent_time NUMERIC;
  v_prior_time NUMERIC;
  v_acc_drop NUMERIC;
  v_time_drift NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(AVG(
      LEAST(100, GREATEST(0,
        (CASE WHEN time_taken_seconds < 45
          THEN ((45 - time_taken_seconds) / 45.0) * 100
          ELSE 0 END) * 0.70
        +
        (CASE WHEN COALESCE(time_to_first_click, 999) < 15
          THEN ((15 - time_to_first_click) / 15.0) * 100
          ELSE 0 END) * 0.30
      ))
    ), 0),
    COALESCE(AVG(
      LEAST(100, GREATEST(0,
        (CASE WHEN time_taken_seconds > 90
          THEN ((time_taken_seconds - 90) / 90.0) * 100
          ELSE 0 END) * 0.70
        +
        (CASE WHEN COALESCE(time_to_first_click, 0) > 30
          THEN ((time_to_first_click - 30) / 30.0) * 100
          ELSE 0 END) * 0.30
      ))
    ), 0)
  INTO v_total, v_rush, v_hesitation
  FROM public.user_attempts
  WHERE user_id = p_user_id;

  -- Fatigue requires enough longitudinal evidence. Compare the latest 20
  -- attempts with the preceding 20. Otherwise leave the prior value intact.
  SELECT
    AVG(CASE WHEN rn <= 20 THEN CASE WHEN is_correct THEN 100 ELSE 0 END END),
    AVG(CASE WHEN rn > 20 AND rn <= 40 THEN CASE WHEN is_correct THEN 100 ELSE 0 END END),
    AVG(CASE WHEN rn <= 20 THEN time_taken_seconds END),
    AVG(CASE WHEN rn > 20 AND rn <= 40 THEN time_taken_seconds END)
  INTO v_recent_accuracy, v_prior_accuracy, v_recent_time, v_prior_time
  FROM (
    SELECT
      is_correct,
      time_taken_seconds,
      ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS rn
    FROM public.user_attempts
    WHERE user_id = p_user_id
  ) a
  WHERE rn <= 40;

  IF v_total >= 40
     AND v_prior_accuracy IS NOT NULL
     AND v_prior_time IS NOT NULL
     AND v_prior_time > 0 THEN
    v_acc_drop := GREATEST(0, v_prior_accuracy - v_recent_accuracy);
    v_time_drift := GREATEST(0, ((v_recent_time - v_prior_time) / v_prior_time) * 100);
    v_fatigue := LEAST(100, ROUND((v_acc_drop * 0.60) + (v_time_drift * 0.40), 2));
  ELSE
    v_fatigue := NULL;
  END IF;

  INSERT INTO public.behavior_profiles (
    user_id, archetype, rush_index, hesitation_index, fatigue_index, updated_at
  )
  VALUES (
    p_user_id, 'unclassified',
    ROUND(v_rush, 2),
    ROUND(v_hesitation, 2),
    v_fatigue,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    rush_index = EXCLUDED.rush_index,
    hesitation_index = EXCLUDED.hesitation_index,
    fatigue_index = COALESCE(EXCLUDED.fatigue_index, public.behavior_profiles.fatigue_index),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_candidate_behavior_profile(UUID)
  FROM PUBLIC, anon, authenticated;

-- Run canonical rebuilds after the existing attempt-intelligence trigger.
CREATE OR REPLACE FUNCTION public.trg_rebuild_candidate_intelligence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $
BEGIN
  PERFORM public.rebuild_candidate_intelligence(NEW.user_id);
  RETURN NEW;
END;
$;

CREATE OR REPLACE FUNCTION public.trg_rebuild_candidate_behavior_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $
BEGIN
  PERFORM public.rebuild_candidate_behavior_profile(NEW.user_id);
  RETURN NEW;
END;
$;

REVOKE ALL ON FUNCTION public.trg_rebuild_candidate_intelligence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_rebuild_candidate_behavior_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_rebuild_candidate_intelligence ON public.user_attempts;
CREATE TRIGGER zz_rebuild_candidate_intelligence
AFTER INSERT ON public.user_attempts
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_candidate_intelligence();

DROP TRIGGER IF EXISTS zz_rebuild_candidate_behavior_profile ON public.user_attempts;
CREATE TRIGGER zz_rebuild_candidate_behavior_profile
AFTER INSERT ON public.user_attempts
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_candidate_behavior_profile();

-- 5. The question ID trigger must have exactly one canonical owner.
DROP TRIGGER IF EXISTS set_zyntra_id_question ON public.questions;
-- Keep trg_assign_zyntra_id_question as the canonical trigger.

-- 6. Remove stale, unvalidated score values. Keep the legacy columns for
-- backwards-compatible schema/imports, but do not generate or expose new values.
UPDATE public.behavior_profiles
SET predicted_score_low = NULL,
    predicted_score_high = NULL,
    predicted_score_potential = NULL
WHERE predicted_score_low IS NOT NULL
   OR predicted_score_high IS NOT NULL
   OR predicted_score_potential IS NOT NULL;

NOTIFY pgrst, 'reload schema';
