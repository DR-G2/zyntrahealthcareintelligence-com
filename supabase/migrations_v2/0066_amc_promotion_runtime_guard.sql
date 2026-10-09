-- P4 promotion guard: validation metrics alone cannot activate a model whose
-- readiness runtime has not been independently verified and versioned.

CREATE OR REPLACE FUNCTION public.amc_promote_calibrated_model(
  p_validation_id uuid,
  p_model_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run record;
  v_plugin record;
  v_gate jsonb;
BEGIN
  SELECT * INTO v_run
  FROM public.amc_validation_run
  WHERE id = p_validation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'validation run not found';
  END IF;

  SELECT * INTO v_plugin
  FROM public.amc_plugin_version
  WHERE id = v_run.plugin_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AMC plugin version not found';
  END IF;

  IF coalesce((v_plugin.assumptions ->> 'readiness_runtime_verified')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'AMC_READINESS_RUNTIME_NOT_VERIFIED'
      USING ERRCODE = 'P0001';
  END IF;

  v_gate := public.amc_evaluate_promotion_gate(p_validation_id);
  IF coalesce((v_gate ->> 'eligible')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'AMC model promotion blocked: %', v_gate -> 'reasons';
  END IF;

  UPDATE public.amc_model_registry
  SET status = 'RETIRED',
      pass_probability_calibrated = false,
      retired_at = now()
  WHERE plugin_version_id = v_plugin.id AND status = 'ACTIVE';

  INSERT INTO public.amc_model_registry(
    plugin_version_id, model_version, model_type, calibration_run_id,
    status, pass_probability_calibrated, activated_at, provenance
  )
  VALUES (
    v_plugin.id, p_model_version, 'calibrated_amc_pass_probability', p_validation_id,
    'ACTIVE', true, now(),
    jsonb_build_object(
      'validation_run', p_validation_id,
      'promotion_gate', v_gate,
      'readiness_runtime_verified', true
    )
  );

  UPDATE public.amc_plugin_version
  SET status = 'ACTIVE',
      assumptions = jsonb_set(
        assumptions, '{readiness_probability_status}', '"CALIBRATED"'::jsonb, true
      )
  WHERE id = v_plugin.id;

  UPDATE public.amc_exam_environment_v1
  SET status = 'ACTIVE',
      target_definition = jsonb_set(
        target_definition, '{pass_probability_calibrated}', 'true'::jsonb, true
      )
  WHERE plugin_version_id = v_plugin.id;

  UPDATE public.amc_validation_run
  SET gate_status = 'PROMOTED', reviewed_at = now()
  WHERE id = p_validation_id;

  RETURN jsonb_build_object('promoted', true, 'modelVersion', p_model_version, 'plugin', 'AMC');
END;
$$;

COMMENT ON FUNCTION public.amc_promote_calibrated_model(uuid, text) IS
'Promotion requires both independent empirical validation and explicit readiness-runtime verification. A passing metrics row alone cannot activate an unimplemented model.';
