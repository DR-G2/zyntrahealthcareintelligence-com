-- Capture candidate confidence for calibration analytics.
-- 1 = guessing, 5 = certain. Nullable preserves older attempts.
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
