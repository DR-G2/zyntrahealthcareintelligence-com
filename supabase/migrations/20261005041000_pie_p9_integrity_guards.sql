-- P9 data-integrity guards.
ALTER TABLE public.pie_observation
  ADD CONSTRAINT pie_observation_time_nonnegative
  CHECK (
    (time_total_ms IS NULL OR time_total_ms >= 0) AND
    (time_to_first_interaction_ms IS NULL OR time_to_first_interaction_ms >= 0) AND
    (time_to_answer_ms IS NULL OR time_to_answer_ms >= 0) AND
    (time_post_decision_ms IS NULL OR time_post_decision_ms >= 0) AND
    (answer_changes IS NULL OR answer_changes >= 0)
  );

ALTER TABLE public.pie_observation
  ADD CONSTRAINT pie_observation_first_final_consistency
  CHECK (
    NOT (outcome = 'CORRECT' AND final_answer_correct = false) AND
    NOT (outcome = 'INCORRECT' AND final_answer_correct = true)
  );

ALTER TABLE public.pie_candidate_state
  ADD CONSTRAINT pie_candidate_state_estimates_bounded
  CHECK (
    capability_estimate BETWEEN 0 AND 1 AND
    decision_estimate BETWEEN 0 AND 1 AND
    timing_estimate BETWEEN 0 AND 1 AND
    calibration_estimate BETWEEN 0 AND 1 AND
    sustained_performance_estimate BETWEEN 0 AND 1 AND
    learning_estimate BETWEEN 0 AND 1
  );

ALTER TABLE public.pie_state_uncertainty
  ADD CONSTRAINT pie_state_uncertainty_valid_bounds
  CHECK (
    variance >= 0 AND
    lower_bound BETWEEN 0 AND 1 AND
    upper_bound BETWEEN 0 AND 1 AND
    lower_bound <= upper_bound AND
    confidence_level BETWEEN 0 AND 1 AND
    evidence_count >= 0 AND
    evidence_quality BETWEEN 0 AND 1
  );

ALTER TABLE public.pie_runtime_decision
  ADD CONSTRAINT pie_runtime_uncertainty_nonnegative CHECK (uncertainty >= 0);

CREATE INDEX IF NOT EXISTS pie_observation_user_occurred_idx
  ON public.pie_observation(user_id, occurred_at, id);
CREATE INDEX IF NOT EXISTS pie_candidate_state_user_sequence_idx
  ON public.pie_candidate_state(user_id, state_sequence DESC);
CREATE INDEX IF NOT EXISTS pie_inference_run_user_started_idx
  ON public.pie_inference_run(user_id, started_at DESC);

COMMENT ON TABLE public.pie_observation IS
 'Canonical observation stream. Invalid temporal values and outcome/final-answer contradictions are rejected.';
