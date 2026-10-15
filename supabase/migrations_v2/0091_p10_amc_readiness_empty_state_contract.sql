-- P10 AMC readiness empty-state contract.
-- Missing candidate evaluation must remain explicitly uncalibrated, not return {}.

CREATE OR REPLACE FUNCTION public.get_my_amc_readiness(p_exam_mode text DEFAULT 'MCQ'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u uuid := auth.uid();
  result jsonb;
  v_plugin_version text;
  v_environment_code text;
begin
  if u is null then
    raise exception 'not authenticated';
  end if;

  select p.plugin_version, e.environment_code
    into v_plugin_version, v_environment_code
  from public.amc_plugin_version p
  join public.amc_exam_environment_v1 e on e.plugin_version_id = p.id
  where p.plugin_code = 'AMC'
    and e.exam_mode = p_exam_mode
  order by p.created_at desc
  limit 1;

  select jsonb_build_object(
    'plugin', 'AMC',
    'pluginVersion', p.plugin_version,
    'examMode', e.exam_mode,
    'environmentCode', e.environment_code,
    'readiness', jsonb_build_object(
      'probability', a.target_probability,
      'index', a.readiness_index,
      'uncertainty', a.uncertainty_measure,
      'lower', a.readiness_index_lower,
      'upper', a.readiness_index_upper,
      'status', a.readiness_status
    ),
    'evidence', jsonb_build_object(
      'count', a.evidence_count,
      'quality', a.evidence_quality,
      'identificationStatus', a.identification_status
    ),
    'modelVersion', a.model_version,
    'probabilityStatus', case
      when a.target_probability is null then 'NOT_CALIBRATED'
      else 'CALIBRATED'
    end
  )
  into result
  from public.amc_adapter_evaluation a
  join public.amc_plugin_version p on p.id = a.plugin_version_id
  join public.amc_exam_environment_v1 e on e.id = a.environment_id
  where a.user_id = u
    and e.exam_mode = p_exam_mode
  order by a.evaluated_at desc
  limit 1;

  if result is not null then
    return result;
  end if;

  -- No candidate evaluation exists yet. Return the explicit, fail-closed
  -- contract instead of {} so clients cannot mistake missing evidence for a
  -- calibrated prediction or fail to distinguish an unassessed candidate.
  return jsonb_build_object(
    'plugin', 'AMC',
    'pluginVersion', v_plugin_version,
    'examMode', p_exam_mode,
    'environmentCode', v_environment_code,
    'readiness', jsonb_build_object(
      'probability', null,
      'index', null,
      'uncertainty', null,
      'lower', null,
      'upper', null,
      'status', 'INSUFFICIENT_EVIDENCE'
    ),
    'evidence', jsonb_build_object(
      'count', 0,
      'quality', null,
      'identificationStatus', 'UNRESOLVED'
    ),
    'modelVersion', null,
    'probabilityStatus', 'NOT_CALIBRATED'
  );
end
$function$;

REVOKE ALL ON FUNCTION public.get_my_amc_readiness(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_amc_readiness(text) TO authenticated, service_role;
