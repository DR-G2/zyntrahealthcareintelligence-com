-- Zyntra Phase 6: canonical Intervention Engine + Effectiveness + Next Best Action
-- Server-owned decision layer. Training recommendations are not diagnoses or pass probabilities.

CREATE TABLE IF NOT EXISTS public.intervention_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  target_signal text NOT NULL,
  delivery_type text NOT NULL DEFAULT 'mcq',
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.intervention_catalog (code, name, description, target_signal, delivery_type)
VALUES
  ('TIMING_DRILL','Timing Drill','A short controlled-timing practice block.','timing','mcq'),
  ('CONFIDENCE_CALIBRATION','Confidence Calibration','Set confidence before answer reveal and compare it with observed correctness.','confidence_calibration','mcq'),
  ('FIRST_INSTINCT_DRILL','First-Instinct Drill','Commit to the first evidence-based answer, then change only when new evidence warrants it.','answer_stability','mcq'),
  ('DIFFICULTY_REMEDIATION','Difficulty Remediation','Step difficulty down briefly, repair the gap, then retest at the next level.','difficulty_handling','mcq'),
  ('KNOWLEDGE_REVIEW','Targeted Knowledge Review','Review the weakest evidenced subject before returning to harder questions.','knowledge_score','mcq'),
  ('SUBJECT_REMEDIATION','Subject Remediation','Concentrated practice on a recurring subject-level performance gap.','subject_accuracy','mcq'),
  ('MIXED_RETEST','Mixed Retest','A balanced retest used when no single signal has enough evidence to dominate.','readiness','mcq')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  target_signal = EXCLUDED.target_signal,
  delivery_type = EXCLUDED.delivery_type,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.candidate_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intervention_id uuid NOT NULL REFERENCES public.intervention_catalog(id),
  action_type text NOT NULL,
  diagnosis_code text NOT NULL,
  subject text,
  priority numeric NOT NULL DEFAULT 0,
  evidence_level text NOT NULL DEFAULT 'insufficient',
  status text NOT NULL DEFAULT 'RECOMMENDED'
    CHECK (status IN ('RECOMMENDED','STARTED','COMPLETED','SKIPPED','EXPIRED')),
  target_signal text NOT NULL,
  baseline_attempt_count integer NOT NULL DEFAULT 0,
  baseline_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_interventions_user_time
  ON public.candidate_interventions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_interventions_user_status
  ON public.candidate_interventions(user_id, status);

CREATE TABLE IF NOT EXISTS public.intervention_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_intervention_id uuid NOT NULL UNIQUE REFERENCES public.candidate_interventions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  observation_window text NOT NULL,
  post_attempt_count integer NOT NULL DEFAULT 0,
  pre_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  post_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  delta numeric,
  effectiveness_status text NOT NULL DEFAULT 'INSUFFICIENT_EVIDENCE'
    CHECK (effectiveness_status IN ('EFFECTIVE','PARTIALLY_EFFECTIVE','INEFFECTIVE','INSUFFICIENT_EVIDENCE')),
  evidence_level text NOT NULL DEFAULT 'insufficient',
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_user_time
  ON public.intervention_outcomes(user_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.next_best_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_intervention_id uuid REFERENCES public.candidate_interventions(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  priority numeric NOT NULL DEFAULT 0,
  diagnosis_code text NOT NULL,
  reason_text text NOT NULL,
  subject text,
  expected_signal text NOT NULL,
  evidence_level text NOT NULL DEFAULT 'insufficient',
  status text NOT NULL DEFAULT 'RECOMMENDED'
    CHECK (status IN ('RECOMMENDED','STARTED','COMPLETED','SUPERSEDED','EXPIRED')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  signal_version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_next_best_actions_user_time
  ON public.next_best_actions(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_next_best_actions_user_status
  ON public.next_best_actions(user_id, status);

ALTER TABLE public.intervention_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.next_best_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view active intervention catalog" ON public.intervention_catalog;
CREATE POLICY "Users can view active intervention catalog"
  ON public.intervention_catalog FOR SELECT TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Users can view own candidate interventions" ON public.candidate_interventions;
CREATE POLICY "Users can view own candidate interventions"
  ON public.candidate_interventions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own intervention outcomes" ON public.intervention_outcomes;
CREATE POLICY "Users can view own intervention outcomes"
  ON public.intervention_outcomes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own next best actions" ON public.next_best_actions;
CREATE POLICY "Users can view own next best actions"
  ON public.next_best_actions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.intervention_catalog, public.candidate_interventions,
     public.intervention_outcomes, public.next_best_actions
  FROM anon, authenticated;

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
  v_existing public.next_best_actions%ROWTYPE;
  v_catalog public.intervention_catalog%ROWTYPE;
  v_action text := 'MIXED_RETEST';
  v_diagnosis text := 'INSUFFICIENT_EVIDENCE';
  v_reason text := 'No single training signal has enough evidence to dominate the next action.';
  v_target text := 'readiness';
  v_subject_name text;
  v_priority numeric := 20;
  v_evidence text := 'insufficient';
  v_attempts integer := 0;
  v_intervention uuid;
  v_candidate_intervention uuid;
  v_nba uuid;
  v_baseline jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('action','MIXED_RETEST','evidence_level','insufficient','reason','Candidate context is unavailable.');
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Candidate isolation violation';
  END IF;

  SELECT * INTO v_readiness FROM public.readiness_dna WHERE user_id = p_user_id;
  SELECT * INTO v_behavior FROM public.behavior_dna WHERE user_id = p_user_id;

  v_attempts := COALESCE(v_readiness.attempt_count, 0);
  v_evidence := COALESCE(v_readiness.evidence_level, 'insufficient');

  -- Reuse a fresh recommendation rather than generating rows on every render.
  SELECT * INTO v_existing
  FROM public.next_best_actions
  WHERE user_id = p_user_id
    AND status = 'RECOMMENDED'
    AND generated_at > now() - interval '30 minutes'
  ORDER BY generated_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'action', v_existing.action_type,
      'subject', v_existing.subject,
      'priority', v_existing.priority,
      'diagnosis_code', v_existing.diagnosis_code,
      'evidence_level', v_existing.evidence_level,
      'expected_signal', v_existing.expected_signal,
      'reason', v_existing.reason_text,
      'generated_at', v_existing.generated_at,
      'signal_version', v_existing.signal_version
    );
  END IF;

  SELECT subject,
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

  -- Evidence gates prevent a single bad question from creating an intervention.
  IF v_attempts >= 10 AND COALESCE(v_behavior.rush_index, 0) >= 35 THEN
    v_action := 'TIMING_DRILL';
    v_diagnosis := 'TIMING_PROBLEM';
    v_target := 'timing';
    v_priority := GREATEST(60, v_behavior.rush_index);
    v_reason := 'Repeated attempts show a meaningful rushed-response signal. Use controlled timing before returning to harder questions.';
  ELSIF v_attempts >= 10 AND COALESCE(v_behavior.hesitation_index, 0) >= 35 THEN
    v_action := 'TIMING_DRILL';
    v_diagnosis := 'TIMING_PROBLEM';
    v_target := 'timing';
    v_priority := GREATEST(60, v_behavior.hesitation_index);
    v_reason := 'Repeated attempts show prolonged decision time. Use a timed drill focused on structured commitment.';
  ELSIF v_attempts >= 10 AND COALESCE(v_behavior.confidence_miscalibration, 0) >= 30 THEN
    v_action := 'CONFIDENCE_CALIBRATION';
    v_diagnosis := 'CONFIDENCE_MISCALIBRATION';
    v_target := 'confidence_calibration';
    v_priority := GREATEST(60, v_behavior.confidence_miscalibration);
    v_reason := 'Confidence is materially misaligned with observed correctness. Set confidence before answer reveal, then retest.';
  ELSIF v_attempts >= 10 AND (
      COALESCE(v_behavior.answer_instability_index, 0) >= 35
      OR COALESCE(v_behavior.correct_to_wrong_change_rate, 0) >= 30
    ) THEN
    v_action := 'FIRST_INSTINCT_DRILL';
    v_diagnosis := 'ANSWER_INSTABILITY';
    v_target := 'answer_stability';
    v_priority := GREATEST(
      60,
      COALESCE(v_behavior.answer_instability_index, 0),
      COALESCE(v_behavior.correct_to_wrong_change_rate, 0)
    );
    v_reason := 'Answer changes are contributing to instability. Practise evidence-based first-instinct decisions before changing an answer.';
  ELSIF v_attempts >= 10 AND COALESCE(v_readiness.difficulty_handling, 0) < 55 THEN
    v_action := 'DIFFICULTY_REMEDIATION';
    v_diagnosis := 'DIFFICULTY_COLLAPSE';
    v_target := 'difficulty_handling';
    v_priority := 65;
    v_reason := 'Performance on harder questions is lagging the broader training state. Step down briefly, repair the gap, then retest.';
  ELSIF v_attempts >= 10 AND COALESCE(v_readiness.knowledge_score, 0) < 60 THEN
    v_action := 'KNOWLEDGE_REVIEW';
    v_diagnosis := 'KNOWLEDGE_GAP';
    v_target := 'knowledge_score';
    v_priority := 65;
    v_reason := 'Observed accuracy indicates a knowledge gap should be addressed before adding more difficulty.';
  ELSIF v_subject_name IS NOT NULL
    AND COALESCE(v_subject.priority, 0) >= 40
    AND COALESCE(v_subject.evidence_level, 'insufficient') <> 'insufficient' THEN
    v_action := 'SUBJECT_REMEDIATION';
    v_diagnosis := 'SUBJECT_WEAKNESS';
    v_target := 'subject_accuracy';
    v_priority := v_subject.priority;
    v_reason := 'A recurring subject-level gap is currently the strongest actionable weakness.';
  END IF;

  SELECT * INTO v_catalog
  FROM public.intervention_catalog
  WHERE code = v_action AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_catalog FROM public.intervention_catalog WHERE code = 'MIXED_RETEST' AND active = true LIMIT 1;
  END IF;

  v_baseline := jsonb_build_object(
    'attempt_count', v_attempts,
    'knowledge_score', COALESCE(v_readiness.knowledge_score, 0),
    'difficulty_handling', COALESCE(v_readiness.difficulty_handling, 0),
    'answer_stability', COALESCE(v_readiness.answer_stability, 0),
    'confidence_score', COALESCE(v_readiness.confidence_score, 0),
    'rush_index', COALESCE(v_behavior.rush_index, 0),
    'hesitation_index', COALESCE(v_behavior.hesitation_index, 0),
    'confidence_miscalibration', COALESCE(v_behavior.confidence_miscalibration, 0),
    'answer_instability_index', COALESCE(v_behavior.answer_instability_index, 0),
    'subject_accuracy', COALESCE(v_subject.priority, 0)
  );

  UPDATE public.next_best_actions
  SET status = 'SUPERSEDED'
  WHERE user_id = p_user_id AND status = 'RECOMMENDED';

  INSERT INTO public.candidate_interventions (
    user_id, intervention_id, action_type, diagnosis_code, subject,
    priority, evidence_level, target_signal, baseline_attempt_count, baseline_snapshot
  )
  VALUES (
    p_user_id, v_catalog.id, v_action, v_diagnosis, v_subject_name,
    v_priority, v_evidence, v_target, v_attempts, v_baseline
  )
  RETURNING id INTO v_candidate_intervention;

  INSERT INTO public.next_best_actions (
    user_id, candidate_intervention_id, action_type, priority,
    diagnosis_code, reason_text, subject, expected_signal,
    evidence_level, expires_at
  )
  VALUES (
    p_user_id, v_candidate_intervention, v_action, v_priority,
    v_diagnosis, v_reason, v_subject_name, v_target,
    v_evidence, now() + interval '24 hours'
  )
  RETURNING id INTO v_nba;

  RETURN jsonb_build_object(
    'id', v_nba,
    'candidate_intervention_id', v_candidate_intervention,
    'action', v_action,
    'subject', v_subject_name,
    'priority', ROUND(v_priority, 2),
    'diagnosis_code', v_diagnosis,
    'evidence_level', v_evidence,
    'expected_signal', v_target,
    'reason', v_reason,
    'generated_at', now(),
    'signal_version', 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.start_next_best_action(p_action_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action public.next_best_actions%ROWTYPE;
  v_intervention public.candidate_interventions%ROWTYPE;
BEGIN
  SELECT * INTO v_action
  FROM public.next_best_actions
  WHERE id = p_action_id AND user_id = auth.uid();

  IF NOT FOUND THEN RAISE EXCEPTION 'Action not found'; END IF;
  IF v_action.status <> 'RECOMMENDED' THEN
    RETURN jsonb_build_object('status', v_action.status, 'action_id', p_action_id);
  END IF;

  SELECT * INTO v_intervention
  FROM public.candidate_interventions
  WHERE id = v_action.candidate_intervention_id AND user_id = auth.uid();

  UPDATE public.next_best_actions
  SET status = 'STARTED'
  WHERE id = v_action.id;

  UPDATE public.candidate_interventions
  SET status = 'STARTED', started_at = now(), updated_at = now()
  WHERE id = v_intervention.id;

  INSERT INTO public.behavior_events (
    user_id, event_type, payload, occurred_at
  )
  VALUES (
    auth.uid(),
    'INTERVENTION_STARTED',
    jsonb_build_object(
      'action_id', v_action.id,
      'candidate_intervention_id', v_intervention.id,
      'intervention_type', v_action.action_type,
      'diagnosis_code', v_action.diagnosis_code
    ),
    now()
  );

  RETURN jsonb_build_object(
    'status','STARTED',
    'action_id',v_action.id,
    'candidate_intervention_id',v_intervention.id,
    'action',v_action.action_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_candidate_intervention(p_candidate_intervention_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ci public.candidate_interventions%ROWTYPE;
  v_readiness public.readiness_dna%ROWTYPE;
  v_behavior public.behavior_dna%ROWTYPE;
  v_baseline jsonb;
  v_post jsonb;
  v_delta numeric;
  v_status text := 'INSUFFICIENT_EVIDENCE';
  v_evidence text := 'insufficient';
  v_post_attempts integer := 0;
  v_required integer := 5;
  v_outcome_id uuid;
BEGIN
  SELECT * INTO v_ci
  FROM public.candidate_interventions
  WHERE id = p_candidate_intervention_id AND user_id = auth.uid();

  IF NOT FOUND THEN RAISE EXCEPTION 'Intervention not found'; END IF;

  SELECT * INTO v_readiness FROM public.readiness_dna WHERE user_id = auth.uid();
  SELECT * INTO v_behavior FROM public.behavior_dna WHERE user_id = auth.uid();

  v_post_attempts := GREATEST(0, COALESCE(v_readiness.attempt_count, 0) - v_ci.baseline_attempt_count);
  v_required := CASE
    WHEN v_ci.target_signal IN ('knowledge_score','difficulty_handling','subject_accuracy') THEN 3
    ELSE 5
  END;

  v_baseline := v_ci.baseline_snapshot;
  v_post := jsonb_build_object(
    'attempt_count', COALESCE(v_readiness.attempt_count, 0),
    'knowledge_score', COALESCE(v_readiness.knowledge_score, 0),
    'difficulty_handling', COALESCE(v_readiness.difficulty_handling, 0),
    'answer_stability', COALESCE(v_readiness.answer_stability, 0),
    'confidence_score', COALESCE(v_readiness.confidence_score, 0),
    'rush_index', COALESCE(v_behavior.rush_index, 0),
    'hesitation_index', COALESCE(v_behavior.hesitation_index, 0),
    'confidence_miscalibration', COALESCE(v_behavior.confidence_miscalibration, 0),
    'answer_instability_index', COALESCE(v_behavior.answer_instability_index, 0)
  );

  v_delta := CASE v_ci.target_signal
    WHEN 'knowledge_score' THEN (v_post->>'knowledge_score')::numeric - COALESCE((v_baseline->>'knowledge_score')::numeric,0)
    WHEN 'difficulty_handling' THEN (v_post->>'difficulty_handling')::numeric - COALESCE((v_baseline->>'difficulty_handling')::numeric,0)
    WHEN 'answer_stability' THEN (v_post->>'answer_stability')::numeric - COALESCE((v_baseline->>'answer_stability')::numeric,0)
    WHEN 'confidence_calibration' THEN (v_post->>'confidence_score')::numeric - COALESCE((v_baseline->>'confidence_score')::numeric,0)
    WHEN 'timing' THEN (
      (COALESCE((v_baseline->>'rush_index')::numeric,0) + COALESCE((v_baseline->>'hesitation_index')::numeric,0)) / 2
      - (COALESCE((v_post->>'rush_index')::numeric,0) + COALESCE((v_post->>'hesitation_index')::numeric,0)) / 2
    )
    ELSE NULL
  END;

  IF v_post_attempts >= v_required THEN
    v_status := CASE
      WHEN v_delta >= 10 THEN 'EFFECTIVE'
      WHEN v_delta >= 3 THEN 'PARTIALLY_EFFECTIVE'
      ELSE 'INEFFECTIVE'
    END;
    v_evidence := CASE
      WHEN v_post_attempts >= 10 THEN 'established'
      ELSE 'emerging'
    END;
  END IF;

  INSERT INTO public.intervention_outcomes (
    candidate_intervention_id, user_id, observation_window,
    post_attempt_count, pre_metrics, post_metrics, delta,
    effectiveness_status, evidence_level
  )
  VALUES (
    v_ci.id, auth.uid(),
    format('post_intervention_attempts:%s', v_post_attempts),
    v_post_attempts, v_baseline, v_post, v_delta,
    v_status, v_evidence
  )
  ON CONFLICT (candidate_intervention_id) DO UPDATE SET
    post_attempt_count = EXCLUDED.post_attempt_count,
    post_metrics = EXCLUDED.post_metrics,
    delta = EXCLUDED.delta,
    effectiveness_status = EXCLUDED.effectiveness_status,
    evidence_level = EXCLUDED.evidence_level,
    observed_at = now()
  RETURNING id INTO v_outcome_id;

  IF v_status <> 'INSUFFICIENT_EVIDENCE' THEN
    UPDATE public.candidate_interventions
    SET status = 'COMPLETED', completed_at = now(), updated_at = now()
    WHERE id = v_ci.id;

    UPDATE public.next_best_actions
    SET status = 'COMPLETED'
    WHERE candidate_intervention_id = v_ci.id;

    INSERT INTO public.behavior_events (
      user_id, event_type, payload, occurred_at
    )
    VALUES (
      auth.uid(),
      'INTERVENTION_OUTCOME',
      jsonb_build_object(
        'candidate_intervention_id', v_ci.id,
        'intervention_type', v_ci.action_type,
        'effectiveness_status', v_status,
        'delta', v_delta,
        'post_attempt_count', v_post_attempts,
        'evidence_level', v_evidence
      ),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'outcome_id', v_outcome_id,
    'candidate_intervention_id', v_ci.id,
    'effectiveness_status', v_status,
    'evidence_level', v_evidence,
    'delta', v_delta,
    'post_attempt_count', v_post_attempts
  );
END;
$$;

-- Historical effectiveness is descriptive only. It aggregates observed outcomes,
-- never claims that an intervention caused the change.
CREATE OR REPLACE FUNCTION public.get_intervention_effectiveness(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Candidate isolation violation';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x))
    FROM (
      SELECT
        ci.action_type,
        COUNT(*)::integer AS observations,
        ROUND(AVG(io.delta),2) AS mean_delta,
        COUNT(*) FILTER (WHERE io.effectiveness_status = 'EFFECTIVE')::integer AS effective,
        COUNT(*) FILTER (WHERE io.effectiveness_status = 'PARTIALLY_EFFECTIVE')::integer AS partially_effective,
        COUNT(*) FILTER (WHERE io.effectiveness_status = 'INEFFECTIVE')::integer AS ineffective,
        COUNT(*) FILTER (WHERE io.effectiveness_status = 'INSUFFICIENT_EVIDENCE')::integer AS insufficient_evidence
      FROM public.intervention_outcomes io
      JOIN public.candidate_interventions ci ON ci.id = io.candidate_intervention_id
      WHERE io.user_id = p_user_id
      GROUP BY ci.action_type
      ORDER BY COUNT(*) DESC
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_best_action(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_best_action(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.start_next_best_action(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_next_best_action(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_candidate_intervention(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_candidate_intervention(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_intervention_effectiveness(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_intervention_effectiveness(uuid) TO authenticated;

-- Reset must remove all Phase 6 derived state and preserve candidate isolation.
CREATE OR REPLACE FUNCTION public.reset_candidate_training_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  DELETE FROM public.next_best_actions WHERE user_id = v_user_id;
  DELETE FROM public.intervention_outcomes WHERE user_id = v_user_id;
  DELETE FROM public.candidate_interventions WHERE user_id = v_user_id;
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
  SET weak_areas = NULL, onboarding_complete = false, updated_at = now()
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_candidate_training_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_candidate_training_data() TO authenticated;

NOTIFY pgrst, 'reload schema';
