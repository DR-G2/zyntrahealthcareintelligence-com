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

CREATE OR REPLACE FUNCTION pie.assert_blueprint(p_blueprint_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_blueprint_id uuid;
  v_has_eligible_mapping boolean;
BEGIN
  IF p_blueprint_key IS NULL OR btrim(p_blueprint_key) = '' THEN
    RAISE EXCEPTION 'blueprint key is required' USING ERRCODE = '22023';
  END IF;

  SELECT b.id INTO v_blueprint_id
  FROM amc.amc_blueprint b
  WHERE b.blueprint_key = p_blueprint_key
    AND (b.effective_from IS NULL OR b.effective_from <= now())
    AND (b.effective_to IS NULL OR b.effective_to > now())
  ORDER BY b.effective_from DESC NULLS LAST
  LIMIT 1;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive blueprint: %', p_blueprint_key USING ERRCODE = '22023';
  END IF;

  IF p_blueprint_key LIKE 'AMC\_%' ESCAPE '\' THEN
    SELECT EXISTS (
      SELECT 1 FROM amc.amc_blueprint_lo bl
      WHERE bl.blueprint_id = v_blueprint_id AND bl.eligible
    ) INTO v_has_eligible_mapping;
    IF NOT v_has_eligible_mapping THEN
      RAISE EXCEPTION 'AMC_BLUEPRINT_MAPPING_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION pie.assert_blueprint(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pie.assert_blueprint(text) TO service_role;

CREATE OR REPLACE FUNCTION public.amc_p5_practice_status(p_exam_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
  v_plugin record;
  v_blueprint_key text;
  v_selector_verified boolean := false;
  v_plugin_active boolean := false;
  v_environment_status text;
  v_eligible_lo_count integer := 0;
  v_mapped_count integer := 0;
  v_approved_count integer := 0;
  v_selector_status text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  IF p_exam_mode NOT IN ('MCQ','CLINICAL') THEN
    RAISE EXCEPTION 'invalid exam mode' USING ERRCODE = '22023';
  END IF;

  v_blueprint_key := CASE p_exam_mode
    WHEN 'MCQ' THEN 'AMC_CAT_MCQ'
    WHEN 'CLINICAL' THEN 'AMC_CLINICAL'
  END;

  SELECT * INTO v_plugin
  FROM public.amc_plugin_version
  WHERE plugin_code = 'AMC' AND plugin_version = '1.0.0'
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMC plugin version unavailable' USING ERRCODE = 'P0002';
  END IF;

  v_selector_verified := coalesce((v_plugin.assumptions ->> 'pie_selector_verified')::boolean, false);
  v_plugin_active := v_plugin.status = 'ACTIVE';

  SELECT e.status INTO v_environment_status
  FROM public.amc_exam_environment_v1 e
  WHERE e.plugin_version_id = v_plugin.id AND e.exam_mode = p_exam_mode
  ORDER BY e.created_at DESC
  LIMIT 1;

  SELECT count(*) INTO v_eligible_lo_count
  FROM amc.amc_blueprint b
  JOIN amc.amc_blueprint_lo bl ON bl.blueprint_id = b.id AND bl.eligible
  WHERE b.id = (
    SELECT b2.id FROM amc.amc_blueprint b2
    WHERE b2.blueprint_key = v_blueprint_key
      AND (b2.effective_from IS NULL OR b2.effective_from <= now())
      AND (b2.effective_to IS NULL OR b2.effective_to > now())
    ORDER BY b2.effective_from DESC NULLS LAST
    LIMIT 1
  );

  SELECT count(*) INTO v_approved_count
  FROM public.amc_question_context qc
  WHERE qc.plugin_version_id = v_plugin.id
    AND qc.exam_mode = p_exam_mode
    AND qc.metadata ->> 'review_status' = 'APPROVED'
    AND nullif(qc.metadata ->> 'reviewed_by', '') IS NOT NULL
    AND nullif(qc.metadata ->> 'reviewed_at', '') IS NOT NULL
    AND qc.patient_group IS NOT NULL
    AND coalesce(qc.clinical_domain, qc.task_type) IS NOT NULL
    AND qc.amc_relevance IS NOT NULL
    AND qc.source_evidence_level IS NOT NULL;

  SELECT count(DISTINCT qc.question_id) INTO v_mapped_count
  FROM public.amc_question_context qc
  JOIN public.questions q ON q.id = qc.question_id AND qc.question_version = q.version::text
  JOIN pie.question_lo ql ON ql.question_id = q.id AND ql.is_primary
  JOIN amc.amc_blueprint_lo bl ON bl.lo_id = ql.lo_id AND bl.eligible
  JOIN amc.amc_blueprint b ON b.id = bl.blueprint_id
  WHERE qc.plugin_version_id = v_plugin.id
    AND qc.exam_mode = p_exam_mode
    AND qc.metadata ->> 'review_status' = 'APPROVED'
    AND nullif(qc.metadata ->> 'reviewed_by', '') IS NOT NULL
    AND nullif(qc.metadata ->> 'reviewed_at', '') IS NOT NULL
    AND qc.patient_group IS NOT NULL
    AND coalesce(qc.clinical_domain, qc.task_type) IS NOT NULL
    AND qc.amc_relevance IS NOT NULL
    AND qc.source_evidence_level IS NOT NULL
    AND b.id = (
      SELECT b2.id FROM amc.amc_blueprint b2
      WHERE b2.blueprint_key = v_blueprint_key
        AND (b2.effective_from IS NULL OR b2.effective_from <= now())
        AND (b2.effective_to IS NULL OR b2.effective_to > now())
      ORDER BY b2.effective_from DESC NULLS LAST
      LIMIT 1
    );

  v_selector_status := CASE
    WHEN NOT v_plugin_active OR v_environment_status IS DISTINCT FROM 'ACTIVE' OR NOT v_selector_verified THEN 'NOT_CERTIFIED'
    WHEN v_eligible_lo_count = 0 OR v_mapped_count = 0 THEN 'MAPPING_REQUIRED'
    ELSE 'READY'
  END;

  RETURN jsonb_build_object(
    'plugin', 'AMC',
    'pluginVersion', v_plugin.plugin_version,
    'examMode', p_exam_mode,
    'mappedQuestionCount', v_mapped_count,
    'approvedQuestionCount', v_approved_count,
    'eligibleLearningObjectiveCount', v_eligible_lo_count,
    'pluginStatus', v_plugin.status,
    'environmentStatus', v_environment_status,
    'selectorStatus', v_selector_status,
    'mappingStatus', CASE WHEN v_approved_count > 0 THEN 'REVIEWED_METADATA_PRESENT' ELSE 'MAPPING_REQUIRED' END,
    'canStartAMCPractice', v_selector_status = 'READY',
    'reason', CASE
      WHEN NOT v_plugin_active OR v_environment_status IS DISTINCT FROM 'ACTIVE' THEN 'AMC plugin and exam environment must be ACTIVE before question delivery.'
      WHEN NOT v_selector_verified THEN 'PIE AMC selector certification is not recorded.'
      WHEN v_eligible_lo_count = 0 THEN 'No eligible AMC blueprint-to-learning-objective mappings exist.'
      WHEN v_mapped_count = 0 THEN 'No reviewed, version-matched AMC questions are eligible for this blueprint.'
      ELSE 'Reviewed questions and eligible blueprint mappings are present.'
    END
  );
END;
$;

REVOKE ALL ON FUNCTION public.amc_p5_practice_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amc_p5_practice_status(text) TO service_role;

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
  v_exam_mode text;
  v_plugin_version_id uuid;
  v_is_mapped boolean;
BEGIN
  SELECT ps.config ->> 'blueprint_key'
  INTO v_blueprint_key
  FROM public.practice_sessions ps
  WHERE ps.id = NEW.session_id;

  IF v_blueprint_key IS NULL OR v_blueprint_key NOT LIKE 'AMC\_%' ESCAPE '\' THEN
    RETURN NEW;
  END IF;

  v_exam_mode := CASE v_blueprint_key
    WHEN 'AMC_CAT_MCQ' THEN 'MCQ'
    WHEN 'AMC_CLINICAL' THEN 'CLINICAL'
    ELSE NULL
  END;
  IF v_exam_mode IS NULL THEN
    RAISE EXCEPTION 'AMC_BLUEPRINT_MODE_UNSUPPORTED' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.id INTO v_plugin_version_id
  FROM public.amc_plugin_version p
  WHERE p.plugin_code = 'AMC' AND p.plugin_version = '1.0.0'
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM pie.question_lo ql
    JOIN public.questions q ON q.id = ql.question_id
    JOIN amc.amc_blueprint_lo bl ON bl.lo_id = ql.lo_id AND bl.eligible
    JOIN amc.amc_blueprint b ON b.id = bl.blueprint_id
    JOIN public.amc_question_context qc
      ON qc.plugin_version_id = v_plugin_version_id
     AND qc.question_id = q.id
     AND qc.question_version = q.version::text
     AND qc.exam_mode = v_exam_mode
     AND qc.metadata ->> 'review_status' = 'APPROVED'
     AND nullif(qc.metadata ->> 'reviewed_by', '') IS NOT NULL
     AND nullif(qc.metadata ->> 'reviewed_at', '') IS NOT NULL
     AND qc.patient_group IS NOT NULL
     AND coalesce(qc.clinical_domain, qc.task_type) IS NOT NULL
     AND qc.amc_relevance IS NOT NULL
     AND qc.source_evidence_level IS NOT NULL
    WHERE ql.question_id = NEW.question_id
      AND ql.is_primary
      AND b.blueprint_key = v_blueprint_key
      AND (b.effective_from IS NULL OR b.effective_from <= now())
      AND (b.effective_to IS NULL OR b.effective_to > now())
  ) INTO v_is_mapped;

  IF NOT v_is_mapped THEN
    RAISE EXCEPTION 'AMC_QUESTION_NOT_REVIEWED_AND_MAPPED_TO_ACTIVE_BLUEPRINT'
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
'Prevents unreviewed, version-mismatched, untagged, or blueprint-ineligible questions from entering an AMC session.';
