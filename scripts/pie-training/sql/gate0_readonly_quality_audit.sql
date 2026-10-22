-- PIE Gate 0: read-only dataset quality audit.
-- Run with a read-only database role. No DDL/DML, exports, or personal identifiers.
-- Do not use the results to infer human-data eligibility without source-owner review.

-- 1. Source volume and user/session cardinality.
SELECT
  'public.user_attempts' AS source,
  count(*) AS rows,
  count(DISTINCT user_id) AS distinct_users,
  count(DISTINCT session_id) AS distinct_sessions,
  min(created_at) AS first_seen,
  max(created_at) AS last_seen
FROM public.user_attempts
UNION ALL
SELECT 'pie.pie_observation', count(*), count(DISTINCT user_id), NULL,
       min(observed_at), max(observed_at)
FROM pie.pie_observation
UNION ALL
SELECT 'intelligence.behavior_events', count(*), count(DISTINCT user_id), NULL,
       min(occurred_at), max(occurred_at)
FROM intelligence.behavior_events;

-- 2. Attempt provenance. All unapproved provenance must remain unknown/excluded.
SELECT coalesce(provenance->>'source', '<null>') AS source_label,
       count(*) AS attempts,
       count(DISTINCT user_id) AS distinct_users,
       count(DISTINCT session_id) AS distinct_sessions,
       min(created_at) AS first_seen,
       max(created_at) AS last_seen
FROM public.user_attempts
GROUP BY 1
ORDER BY attempts DESC;

-- 3. PIE observation provenance.
SELECT coalesce(provenance->>'source', '<null>') AS source_label,
       observation_type,
       count(*) AS observations,
       count(*) FILTER (WHERE question_id IS NULL) AS missing_question_id,
       count(*) FILTER (WHERE attempt_id IS NULL) AS missing_attempt_id
FROM pie.pie_observation
GROUP BY 1, 2
ORDER BY observations DESC;

-- 4. Attempt-to-observation join integrity.
SELECT
  count(*) AS total_attempts,
  count(*) FILTER (WHERE o.id IS NOT NULL) AS attempts_with_observation,
  count(*) FILTER (WHERE o.id IS NULL) AS attempts_without_observation,
  count(DISTINCT ua.id) AS distinct_attempt_ids
FROM public.user_attempts ua
LEFT JOIN pie.pie_observation o ON o.attempt_id = ua.id;

SELECT count(*) AS orphan_observations
FROM pie.pie_observation o
LEFT JOIN public.user_attempts ua ON ua.id = o.attempt_id
WHERE o.attempt_id IS NOT NULL AND ua.id IS NULL;

-- 5. Compare the latest linked observation with its saved attempt.
-- Aggregate counts only; do not export row-level candidate data.
SELECT
  count(*) AS attempts,
  count(*) FILTER (WHERE o.id IS NOT NULL) AS attempts_with_observation,
  count(*) FILTER (
    WHERE o.id IS NOT NULL
      AND o.payload->>'is_correct' IS DISTINCT FROM ua.is_correct::text
  ) AS outcome_payload_mismatch,
  count(*) FILTER (
    WHERE o.id IS NOT NULL
      AND o.payload->>'confidence_level' IS DISTINCT FROM ua.confidence_level::text
  ) AS confidence_payload_mismatch,
  count(*) FILTER (
    WHERE o.id IS NOT NULL
      AND o.payload->>'selected_answer' IS DISTINCT FROM ua.selected_answer
  ) AS selected_answer_payload_mismatch,
  count(*) FILTER (
    WHERE o.id IS NOT NULL
      AND o.provenance->>'question_version' IS NOT NULL
      AND o.provenance->>'question_version' <> ua.question_version::text
  ) AS observation_question_version_mismatch
FROM public.user_attempts ua
LEFT JOIN LATERAL (
  SELECT id, payload, provenance
  FROM pie.pie_observation
  WHERE attempt_id = ua.id
  ORDER BY observed_at DESC, created_at DESC
  LIMIT 1
) o ON true;

-- 6. Label, timing, confidence and question-key quality.
SELECT
  count(*) AS attempts,
  count(*) FILTER (WHERE is_correct IS NULL) AS missing_outcome,
  count(*) FILTER (WHERE question_id IS NULL) AS missing_question_id,
  count(*) FILTER (WHERE user_id IS NULL) AS missing_user_id,
  count(*) FILTER (WHERE confidence_level IS NULL) AS missing_confidence,
  count(*) FILTER (
    WHERE confidence_level IS NOT NULL
      AND confidence_level NOT BETWEEN 1 AND 5
  ) AS out_of_range_confidence,
  count(*) FILTER (WHERE time_taken_seconds < 0) AS negative_duration,
  count(*) FILTER (WHERE time_to_first_click < 0) AS negative_first_click,
  count(*) FILTER (WHERE change_sequence IS NOT NULL
                    AND jsonb_typeof(change_sequence) <> 'array') AS malformed_change_sequence
FROM public.user_attempts;

-- 7. Attempt/session/question and version coverage.
-- A missing attempt question_version is a gap; do not silently replace it with
-- the current question version when constructing historical features.
SELECT
  count(*) AS attempts,
  count(*) FILTER (WHERE ps.id IS NULL) AS attempts_missing_session_row,
  count(*) FILTER (WHERE q.id IS NULL) AS attempts_missing_question_row,
  count(*) FILTER (WHERE ua.question_version IS NULL) AS missing_attempt_question_version,
  count(*) FILTER (
    WHERE ua.question_version IS NOT NULL AND ua.question_version <> q.version
  ) AS attempt_version_differs_from_current,
  count(*) FILTER (WHERE q.provenance IS NULL OR q.provenance = '{}'::jsonb)
    AS attempts_with_missing_question_provenance
FROM public.user_attempts ua
LEFT JOIN public.practice_sessions ps ON ps.id = ua.session_id
LEFT JOIN public.questions q ON q.id = ua.question_id;

-- 8. Question-to-primary-learning-objective mapping integrity.
SELECT
  count(*) FILTER (WHERE is_primary) AS primary_mappings,
  count(DISTINCT question_id) FILTER (WHERE is_primary) AS questions_with_primary_lo,
  count(*) FILTER (WHERE is_primary AND lo_id IS NULL) AS primary_mapping_missing_lo
FROM pie.question_lo;

SELECT question_id, count(*) AS primary_mapping_count
FROM pie.question_lo
WHERE is_primary
GROUP BY question_id
HAVING count(*) <> 1
ORDER BY primary_mapping_count DESC;

-- 9. Registered synthetic candidates. This is an exclusion list, not proof that
-- unregistered user IDs represent genuine human candidates.
SELECT count(*) AS registered_synthetic_users
FROM pie.synthetic_candidate_registry;

-- 10. Intervention outcome availability.
SELECT 'pie.pie_intervention_outcome' AS source, count(*) AS rows
FROM pie.pie_intervention_outcome
UNION ALL
SELECT 'pie.pie_intervention_effect_estimate', count(*)
FROM pie.pie_intervention_effect_estimate
UNION ALL
SELECT 'intelligence.candidate_interventions', count(*)
FROM intelligence.candidate_interventions;

-- 11. Current question inventory; reconcile against cutover documentation.
SELECT status, count(*) AS questions
FROM public.questions
GROUP BY status
ORDER BY status;

-- Never export candidate names/emails. Keep query outputs aggregate unless a
-- separately approved, access-controlled investigation requires row-level review.
