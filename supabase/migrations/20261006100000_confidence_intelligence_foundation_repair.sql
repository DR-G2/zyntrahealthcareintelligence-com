-- Confidence Intelligence foundation repair
-- Idempotent repair for environments where the confidence migration chain
-- was not applied completely. Raw confidence remains on user_attempts as the
-- source of truth; derived candidate intelligence is exposed through RPC.

ALTER TABLE public.user_attempts
  ADD COLUMN IF NOT EXISTS confidence_level integer;

ALTER TABLE public.user_attempts
  DROP CONSTRAINT IF EXISTS user_attempts_confidence_level_check;

ALTER TABLE public.user_attempts
  ADD CONSTRAINT user_attempts_confidence_level_check
  CHECK (confidence_level IS NULL OR confidence_level BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_user_attempts_confidence
  ON public.user_attempts(user_id, confidence_level)
  WHERE confidence_level IS NOT NULL;

-- Keep the canonical aggregate columns available for readiness surfaces.
ALTER TABLE public.readiness_dna
  ADD COLUMN IF NOT EXISTS confidence_calibration numeric;

ALTER TABLE public.readiness_dna
  ADD COLUMN IF NOT EXISTS confidence_attempt_count integer NOT NULL DEFAULT 0;

UPDATE public.readiness_dna
SET confidence_calibration = 50
WHERE confidence_calibration IS NULL;

-- Candidate-scoped confidence intelligence.
-- Missing confidence is excluded rather than treated as zero.
CREATE OR REPLACE FUNCTION public.get_confidence_intelligence()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH confidence_rows AS (
    SELECT
      ua.is_correct,
      ua.confidence_level,
      ua.created_at,
      q.category AS subject,
      (ua.confidence_level - 1) * 25.0 AS confidence_pct,
      CASE WHEN ua.is_correct THEN 100.0 ELSE 0.0 END AS target_pct
    FROM public.user_attempts ua
    LEFT JOIN public.questions q ON q.id = ua.question_id
    WHERE ua.user_id = v_user_id
      AND ua.confidence_level BETWEEN 1 AND 5
  ),
  scored AS (
    SELECT *,
      GREATEST(0, 100 - ABS(confidence_pct - target_pct)) AS calibration,
      confidence_pct - target_pct AS bias
    FROM confidence_rows
  ),
  totals AS (
    SELECT
      COUNT(*)::integer AS confidence_attempts,
      ROUND(AVG(calibration), 2) AS calibration,
      ROUND(AVG(confidence_pct), 2) AS average_confidence,
      ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END), 2) AS accuracy,
      ROUND(AVG(bias), 2) AS bias,
      ROUND(AVG(GREATEST(bias, 0)), 2) AS overconfidence,
      ROUND(AVG(GREATEST(-bias, 0)), 2) AS underconfidence,
      COUNT(*) FILTER (WHERE confidence_level >= 4 AND NOT is_correct)::integer AS high_confidence_wrong,
      COUNT(*) FILTER (WHERE confidence_level <= 2 AND is_correct)::integer AS low_confidence_correct
    FROM scored
  ),
  recent AS (
    SELECT AVG(calibration) AS value
    FROM (
      SELECT calibration
      FROM scored
      ORDER BY created_at DESC
      LIMIT 20
    ) x
  ),
  prior AS (
    SELECT AVG(calibration) AS value
    FROM (
      SELECT calibration
      FROM scored
      ORDER BY created_at DESC
      OFFSET 20
      LIMIT 20
    ) x
  ),
  levels AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'level', confidence_level,
        'label', CASE confidence_level
          WHEN 1 THEN 'Very low'
          WHEN 2 THEN 'Low'
          WHEN 3 THEN 'Moderate'
          WHEN 4 THEN 'High'
          WHEN 5 THEN 'Very high'
        END,
        'attempts', attempts,
        'accuracy', accuracy,
        'calibration', calibration
      ) ORDER BY confidence_level
    ) AS data
    FROM (
      SELECT
        confidence_level,
        COUNT(*)::integer AS attempts,
        ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END), 1) AS accuracy,
        ROUND(AVG(calibration), 1) AS calibration
      FROM scored
      GROUP BY confidence_level
    ) l
  ),
  subjects AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'subject', subject,
        'attempts', attempts,
        'accuracy', accuracy,
        'average_confidence', average_confidence,
        'calibration', calibration,
        'bias', bias,
        'high_confidence_wrong', high_confidence_wrong,
        'low_confidence_correct', low_confidence_correct
      ) ORDER BY calibration ASC NULLS LAST, attempts DESC
    ) AS data
    FROM (
      SELECT
        COALESCE(subject, 'Uncategorised') AS subject,
        COUNT(*)::integer AS attempts,
        ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0.0 END), 1) AS accuracy,
        ROUND(AVG(confidence_pct), 1) AS average_confidence,
        ROUND(AVG(calibration), 1) AS calibration,
        ROUND(AVG(bias), 1) AS bias,
        COUNT(*) FILTER (WHERE confidence_level >= 4 AND NOT is_correct)::integer AS high_confidence_wrong,
        COUNT(*) FILTER (WHERE confidence_level <= 2 AND is_correct)::integer AS low_confidence_correct
      FROM scored
      GROUP BY COALESCE(subject, 'Uncategorised')
    ) s
  )
  SELECT jsonb_build_object(
    'confidence_attempts', COALESCE(t.confidence_attempts, 0),
    'calibration', COALESCE(t.calibration, 0),
    'average_confidence', COALESCE(t.average_confidence, 0),
    'accuracy', COALESCE(t.accuracy, 0),
    'bias', COALESCE(t.bias, 0),
    'overconfidence', COALESCE(t.overconfidence, 0),
    'underconfidence', COALESCE(t.underconfidence, 0),
    'high_confidence_wrong', COALESCE(t.high_confidence_wrong, 0),
    'low_confidence_correct', COALESCE(t.low_confidence_correct, 0),
    'recent_calibration', COALESCE(r.value, 0),
    'prior_calibration', COALESCE(p.value, 0),
    'calibration_delta', COALESCE(r.value, 0) - COALESCE(p.value, 0),
    'levels', COALESCE(l.data, '[]'::jsonb),
    'subjects', COALESCE(s.data, '[]'::jsonb)
  )
  INTO v_result
  FROM totals t, recent r, prior p, levels l, subjects s;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_confidence_intelligence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_confidence_intelligence() TO authenticated;

COMMENT ON FUNCTION public.get_confidence_intelligence() IS
'Canonical candidate-scoped confidence intelligence. Raw confidence is stored per user_attempt; this function derives calibration, bias, confidence-level and subject intelligence for the authenticated candidate only.';

NOTIFY pgrst, 'reload schema';
