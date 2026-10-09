-- P5: separate general PIE practice from AMC plugin sessions and fail closed
-- until reviewed AMC question-to-learning-objective mappings exist.

INSERT INTO amc.amc_blueprint (
  plugin_version_id, blueprint_key, version, content, effective_from
)
SELECT
  NULL,
  'ZYNTRA_GENERAL',
  'GENERAL_V1',
  jsonb_build_object(
    'kind', 'general_practice',
    'note', 'Exam-neutral practice. Does not claim AMC blueprint coverage.'
  ),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM amc.amc_blueprint
  WHERE blueprint_key = 'ZYNTRA_GENERAL' AND version = 'GENERAL_V1'
);

CREATE OR REPLACE FUNCTION public.guard_amc_practice_session_blueprint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_blueprint_key text;
  v_has_eligible_mapping boolean;
BEGIN
  v_blueprint_key := NEW.config ->> 'blueprint_key';

  IF v_blueprint_key IS NULL OR v_blueprint_key NOT LIKE 'AMC\_%' ESCAPE '\' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM amc.amc_blueprint b
    JOIN amc.amc_blueprint_lo bl ON bl.blueprint_id = b.id AND bl.eligible
    WHERE b.blueprint_key = v_blueprint_key
      AND (b.effective_from IS NULL OR b.effective_from <= now())
      AND (b.effective_to IS NULL OR b.effective_to > now())
  ) INTO v_has_eligible_mapping;

  IF NOT v_has_eligible_mapping THEN
    RAISE EXCEPTION 'AMC_BLUEPRINT_MAPPING_REQUIRED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_amc_practice_session_blueprint() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_amc_practice_session_blueprint ON public.practice_sessions;
CREATE TRIGGER guard_amc_practice_session_blueprint
BEFORE INSERT OR UPDATE OF config ON public.practice_sessions
FOR EACH ROW EXECUTE FUNCTION public.guard_amc_practice_session_blueprint();

CREATE OR REPLACE FUNCTION public.guard_amc_practice_question_mapping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_blueprint_key text;
  v_is_mapped boolean;
BEGIN
  SELECT ps.config ->> 'blueprint_key'
  INTO v_blueprint_key
  FROM public.practice_sessions ps
  WHERE ps.id = NEW.session_id;

  IF v_blueprint_key IS NULL OR v_blueprint_key NOT LIKE 'AMC\_%' ESCAPE '\' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pie.question_lo ql
    JOIN amc.amc_blueprint_lo bl ON bl.lo_id = ql.lo_id AND bl.eligible
    JOIN amc.amc_blueprint b ON b.id = bl.blueprint_id
    WHERE ql.question_id = NEW.question_id
      AND ql.is_primary
      AND b.blueprint_key = v_blueprint_key
      AND (b.effective_from IS NULL OR b.effective_from <= now())
      AND (b.effective_to IS NULL OR b.effective_to > now())
  ) INTO v_is_mapped;

  IF NOT v_is_mapped THEN
    RAISE EXCEPTION 'AMC_QUESTION_NOT_MAPPED_TO_ACTIVE_BLUEPRINT'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_amc_practice_question_mapping() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_amc_practice_question_mapping ON public.practice_session_questions;
CREATE TRIGGER guard_amc_practice_question_mapping
BEFORE INSERT OR UPDATE OF question_id, session_id ON public.practice_session_questions
FOR EACH ROW EXECUTE FUNCTION public.guard_amc_practice_question_mapping();

COMMENT ON FUNCTION public.guard_amc_practice_session_blueprint() IS
'Fails closed for AMC session creation until the selected exam blueprint has reviewed eligible LO mappings.';
COMMENT ON FUNCTION public.guard_amc_practice_question_mapping() IS
'Prevents untagged or blueprint-ineligible questions from entering an AMC session.';
