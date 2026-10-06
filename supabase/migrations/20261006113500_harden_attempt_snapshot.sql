-- Harden the non-authoritative Question DNA snapshot trigger.
-- A missing/stale Question DNA structure must never prevent an answer from saving.

CREATE OR REPLACE FUNCTION public.snapshot_question_dna_on_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_difficulty text;
  v_version integer;
BEGIN
  SELECT q.difficulty, COALESCE(d.version, 1)
  INTO v_difficulty, v_version
  FROM public.questions q
  LEFT JOIN public.question_dna d ON d.question_id = q.id
  WHERE q.id = NEW.question_id;

  NEW.question_difficulty_at_attempt := v_difficulty;
  NEW.question_dna_version_at_attempt := v_version;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[Zyntra] question DNA snapshot skipped: %', SQLERRM;
    RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS trg_snapshot_question_dna_on_attempt ON public.user_attempts;
CREATE TRIGGER trg_snapshot_question_dna_on_attempt
BEFORE INSERT ON public.user_attempts
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_question_dna_on_attempt();

NOTIFY pgrst, 'reload schema';
