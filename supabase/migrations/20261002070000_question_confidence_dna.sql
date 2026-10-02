-- Maintain question-level confidence error independently from the main intelligence trigger.
-- This keeps question DNA useful for adaptive selection without changing the existing
-- aggregate readiness calculations.
CREATE OR REPLACE FUNCTION public.update_question_confidence_dna()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_count integer := 0;
  v_old_error numeric := 0;
  v_confidence numeric;
  v_error numeric;
BEGIN
  IF NEW.confidence_level IS NULL OR NEW.confidence_level NOT BETWEEN 1 AND 5 THEN
    RETURN NEW;
  END IF;

  v_confidence := (NEW.confidence_level - 1) * 25;
  v_error := ABS(v_confidence - CASE WHEN NEW.is_correct THEN 100 ELSE 0 END);

  SELECT attempt_count, confidence_error_rate
    INTO v_old_count, v_old_error
  FROM public.question_dna
  WHERE question_id = NEW.question_id;

  v_old_count := COALESCE(v_old_count, 0);
  v_old_error := COALESCE(v_old_error, 0);

  INSERT INTO public.question_dna (
    question_id,
    confidence_error_rate,
    updated_at
  )
  VALUES (
    NEW.question_id,
    (v_old_error * v_old_count + v_error) / (v_old_count + 1),
    now()
  )
  ON CONFLICT (question_id) DO UPDATE SET
    confidence_error_rate = EXCLUDED.confidence_error_rate,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_question_confidence_dna ON public.user_attempts;

CREATE TRIGGER trg_update_question_confidence_dna
  AFTER INSERT ON public.user_attempts
  FOR EACH ROW
  WHEN (NEW.confidence_level IS NOT NULL)
  EXECUTE FUNCTION public.update_question_confidence_dna();
