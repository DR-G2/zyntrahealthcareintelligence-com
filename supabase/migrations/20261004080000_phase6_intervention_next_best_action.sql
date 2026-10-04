-- Zyntra Phase 6: Intervention Engine + Intervention Effectiveness + Next Best Action
-- Server-owned decision layer. Recommendations are training actions, not diagnoses
-- and do not represent AMC pass probabilities.

CREATE TABLE IF NOT EXISTS public.intervention_effectiveness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intervention_type text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  completed integer NOT NULL DEFAULT 0,
  successful integer NOT NULL DEFAULT 0,
  success_rate numeric NOT NULL DEFAULT 0,
  mean_delta numeric NOT NULL DEFAULT 0,
  latest_outcome_at timestamptz,
  signal_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, intervention_type)
);

ALTER TABLE public.intervention_effectiveness ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own intervention effectiveness"
  ON public.intervention_effectiveness;
CREATE POLICY "Users can view own intervention effectiveness"
  ON public.intervention_effectiveness
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.intervention_effectiveness FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_intervention_effectiveness_user
  ON public.intervention_effectiveness(user_id, intervention_type);

-- Canonical action vocabulary. Keep this deliberately small so the engine
-- selects a training action rather than inventing arbitrary recommendations.
CREATE OR REPLACE FUNCTION public.get_next_best_action(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_readiness public.readiness_dna%ROWTYPE;
  v_behavior public.behavior_dna%ROWTYPE;
  v_subject record;
  v_action text := 'MIXED_RETEST';
  v_reason text := 'No single training signal has enough evidence to dominate the next action.';
  v_subject_name text := NULL;
  v_priority numeric := 0;
  v_evidence text := 'insufficient';
  v_effectiveness numeric := NULL;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'action', 'MIXED_RETEST',
      'evidence_level', 'insufficient',
      'reason', 'Candidate context is unavailable.'
    );
  END IF;

  -- Never expose another candidate's recommendation through this function.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Candidate isolation violation';
  END IF;

  SELECT * INTO v_readiness
  FROM public.readiness_dna
  WHERE user_id = p_user_id;

  SELECT * INTO v_behavior
  FROM public.behavior_dna
  WHERE user_id = p_user_id;

  -- Subject gap is considered first because it is directly actionable and
  -- can be mapped to targeted content without pretending to diagnose ability.
  SELECT
    subject,
    GREATEST(
      100 - COALESCE(accuracy, 0),
      100 - COALESCE(difficulty_handling, 0),
      100 - COALESCE(confidence_calibration, 0)
    ) AS priority,
    evidence_level
  INTO v_subject
  FROM public.subject_dna
  WHERE user_id = p_user_id
    AND attempt_count >= 3
  ORDER BY
    GREATEST(
      100 - COALESCE(accuracy, 0),
      100 - COALESCE(difficulty_handling, 0),
      100 - COALESCE(confidence_calibration, 0)
    ) DESC,
    attempt_count DESC
  LIMIT 1;

  v_subject_name := v_subject.subject;
  v_priority := COALESCE(v_subject.priority, 0);
  v_evidence := COALESCE(v_readiness.evidence_level, 'insufficient');

  -- Behaviour signals can override a generic content recommendation when
  -- they are clearly dominant. This makes the engine intervention-first.
  IF COALESCE(v_behavior.rush_index, 0) >= 35 THEN
    v_action := 'TIMING_DRILL';
    v_reason := 'Recent behaviour shows a meaningful rushed-response signal. Slow the first decision, then retest under controlled timing.';
  ELSIF COALESCE(v_behavior.hesitation_index, 0) >= 35 THEN
    v_action := 'TIMING_DRILL';
    v_reason := 'Recent behaviour shows prolonged decision time. Use a timed drill focused on committing after structured rule-out.';
  ELSIF COALESCE(v_behavior.confidence_miscalibration, 0) >= 30 THEN
    v_action := 'CONFIDENCE_CALIBRATION';
    v_reason := 'Confidence is materially misaligned with observed correctness. Practise confidence setting before revealing the answer.';
  ELSIF COALESCE(v_behavior.answer_instability_index, 0) >= 35
     OR COALESCE(v_behavior.correct_to_wrong_change_rate, 0) >= 30 THEN
    v_action := 'STABILITY_DRILL';
    v_reason := 'Answer changes are contributing to instability. Use first-instinct and evidence-check drills before changing an answer.';
  ELSIF COALESCE(v_readiness.difficulty_handling, 0) < 55
     AND COALESCE(v_readiness.attempt_count, 0) >= 10 THEN
    v_action := 'DIFFICULTY_REMEDIATION';
    v_reason := 'Performance on harder questions is lagging overall performance. Increase difficulty gradually with targeted review.';
  ELSIF COALESCE(v_readiness.knowledge_score, 0) < 60
     AND COALESCE(v_readiness.attempt_count, 0) >= 10 THEN
    v_action := 'KNOWLEDGE_REVIEW';
    v_reason := 'Observed accuracy indicates a knowledge gap should be addressed before adding more difficulty.';
  ELSIF v_subject_name IS NOT NULL AND v_priority >= 35 THEN
    v_action := 'KNOWLEDGE_REVIEW';
    v_reason := 'The weakest evidenced subject currently has the largest actionable performance gap.';
  END IF;

  SELECT success_rate
  INTO v_effectiveness
  FROM public.intervention_effectiveness
  WHERE user_id = p_user_id
    AND intervention_type = v_action;

  RETURN jsonb_build_object(
    'action', v_action,
    'subject', v_subject_name,
    'priority', ROUND(v_priority, 2),
    'evidence_level', v_evidence,
    'data_quality', COALESCE(v_readiness.data_quality, 0),
    'reason', v_reason,
    'historical_effectiveness', v_effectiveness,
    'signal_version', 1,
    'generated_at', now()
  );
END;
$$;

-- Rebuild intervention effectiveness from explicit outcome telemetry.
-- Expected payload:
-- {
--   "intervention_type": "...",
--   "successful": true/false,
--   "delta": number
-- }
CREATE OR REPLACE FUNCTION public.rebuild_intervention_effectiveness(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.intervention_effectiveness
  WHERE user_id = p_user_id;

  INSERT INTO public.intervention_effectiveness (
    user_id,
    intervention_type,
    attempts,
    completed,
    successful,
    success_rate,
    mean_delta,
    latest_outcome_at,
    signal_version,
    updated_at
  )
  SELECT
    p_user_id,
    COALESCE(payload->>'intervention_type', 'UNKNOWN'),
    COUNT(*)::integer,
    COUNT(*)::integer,
    COUNT(*) FILTER (
      WHERE COALESCE((payload->>'successful')::boolean, false)
    )::integer,
    ROUND(
      100.0 * COUNT(*) FILTER (
        WHERE COALESCE((payload->>'successful')::boolean, false)
      ) / GREATEST(COUNT(*), 1),
      2
    ),
    ROUND(COALESCE(AVG((payload->>'delta')::numeric), 0), 2),
    MAX(occurred_at),
    1,
    now()
  FROM public.behavior_events
  WHERE user_id = p_user_id
    AND event_type = 'INTERVENTION_OUTCOME'
    AND payload ? 'intervention_type'
  GROUP BY COALESCE(payload->>'intervention_type', 'UNKNOWN');
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_rebuild_intervention_effectiveness_on_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type = 'INTERVENTION_OUTCOME' THEN
    PERFORM public.rebuild_intervention_effectiveness(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rebuild_intervention_effectiveness_on_event
  ON public.behavior_events;
CREATE TRIGGER trg_rebuild_intervention_effectiveness_on_event
AFTER INSERT ON public.behavior_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_rebuild_intervention_effectiveness_on_event();

-- Expose only the candidate's own recommendation.
REVOKE ALL ON FUNCTION public.get_next_best_action(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_best_action(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.rebuild_intervention_effectiveness(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_rebuild_intervention_effectiveness_on_event()
  FROM PUBLIC, anon, authenticated;

-- Extend reset semantics so intervention history cannot survive a candidate reset.
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
  DELETE FROM public.intervention_effectiveness WHERE user_id = v_user_id;
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

REVOKE ALL ON FUNCTION public.reset_candidate_training_data()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_candidate_training_data()
  TO authenticated;

NOTIFY pgrst, 'reload schema';
