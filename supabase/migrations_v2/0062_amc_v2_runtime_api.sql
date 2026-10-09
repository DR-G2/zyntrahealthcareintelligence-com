-- AMC V2 runtime bridge.
-- All AMC configuration remains in the non-client-exposed amc schema.
-- Only the service-role Edge Function may call this narrow public RPC.

INSERT INTO amc.amc_exam_environment (exam_key, version, environment, effective_from)
SELECT
  'AMC_CLINICAL',
  '2026.1',
  jsonb_build_object(
    'assessed_stations', 16,
    'rest_stations', 4,
    'station_minutes', 10,
    'reading_minutes', 2,
    'assessment_minutes', 8,
    'assessment_areas', jsonb_build_array(
      'HISTORY',
      'EXAMINATION',
      'DIAGNOSTIC_FORMULATION',
      'MANAGEMENT_COUNSELLING_EDUCATION'
    ),
    'source', 'AMC Clinical Examination and Assessment Domains',
    'status_note', 'Development configuration; not an official exam delivery system.'
  ),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM amc.amc_exam_environment
  WHERE exam_key = 'AMC_CLINICAL' AND version = '2026.1'
);

INSERT INTO amc.amc_blueprint (plugin_version_id, blueprint_key, version, content, effective_from)
SELECT
  p.id,
  'AMC_CLINICAL',
  '2026.1',
  jsonb_build_object(
    'assessed_stations', 16,
    'rest_stations', 4,
    'station_minutes', 10,
    'reading_minutes', 2,
    'assessment_minutes', 8,
    'task_domains', jsonb_build_array(
      'HISTORY',
      'EXAMINATION',
      'DIAGNOSTIC_FORMULATION',
      'MANAGEMENT_COUNSELLING_EDUCATION',
      'COMMUNICATION',
      'INVESTIGATION_INTERPRETATION'
    ),
    'source', 'AMC Clinical Examination and Assessment Domains',
    'status_note', 'Development blueprint; confirm against current official AMC materials before release.'
  ),
  now()
FROM amc.amc_plugin_version p
WHERE p.version = '1.0.0'
AND NOT EXISTS (
  SELECT 1 FROM amc.amc_blueprint b
  WHERE b.plugin_version_id = p.id
    AND b.blueprint_key = 'AMC_CLINICAL'
    AND b.version = '2026.1'
);

CREATE OR REPLACE FUNCTION public.amc_plugin_v1_runtime_read(
  p_action text,
  p_exam_mode text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plugin record;
  v_environment record;
  v_blueprint record;
  v_blueprint_key text;
  v_blueprint_version text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  SELECT p.id, p.version, p.status, p.config
  INTO v_plugin
  FROM amc.amc_plugin_version p
  WHERE p.version = '1.0.0'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMC plugin version 1.0.0 is not configured' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'get_summary' THEN
    SELECT e.exam_key, e.version, e.environment, e.effective_from, e.effective_to
    INTO v_environment
    FROM amc.amc_exam_environment e
    WHERE e.exam_key = 'AMC_CAT_MCQ'
      AND e.version = 'V8'
      AND e.effective_from <= now()
      AND (e.effective_to IS NULL OR e.effective_to > now())
    ORDER BY e.effective_from DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'plugin', 'AMC',
      'pluginVersion', v_plugin.version,
      'status', v_plugin.status,
      'environmentCode', v_environment.exam_key,
      'environmentVersion', v_environment.version,
      'environment', v_environment.environment,
      'readiness', NULL,
      'nextAction', NULL
    );
  END IF;

  IF p_action = 'get_blueprint' THEN
    IF p_exam_mode NOT IN ('MCQ', 'CLINICAL') THEN
      RAISE EXCEPTION 'invalid AMC exam mode' USING ERRCODE = '22023';
    END IF;

    IF p_exam_mode = 'MCQ' THEN
      v_blueprint_key := 'AMC_CAT_MCQ';
      v_blueprint_version := 'V8';
    ELSE
      v_blueprint_key := 'AMC_CLINICAL';
      v_blueprint_version := '2026.1';
    END IF;

    SELECT b.blueprint_key, b.version, b.content
    INTO v_blueprint
    FROM amc.amc_blueprint b
    WHERE b.plugin_version_id = v_plugin.id
      AND b.blueprint_key = v_blueprint_key
      AND b.version = v_blueprint_version
    ORDER BY b.effective_from DESC NULLS LAST
    LIMIT 1;

    RETURN jsonb_build_object(
      'plugin', 'AMC',
      'pluginVersion', v_plugin.version,
      'examMode', p_exam_mode,
      'blueprint', v_blueprint.content,
      'blueprintVersion', v_blueprint.version
    );
  END IF;

  RAISE EXCEPTION 'unsupported AMC runtime action' USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.amc_plugin_v1_runtime_read(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amc_plugin_v1_runtime_read(text, text) TO service_role;

COMMENT ON FUNCTION public.amc_plugin_v1_runtime_read(text, text) IS
'Server-only allow-listed AMC plugin configuration read. Does not expose candidate readiness or PIE internals.';
