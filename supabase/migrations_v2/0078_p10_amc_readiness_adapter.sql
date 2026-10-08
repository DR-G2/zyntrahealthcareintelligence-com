-- P10 AMC readiness adapter.
-- This creates an AMC-conditioned engineering readiness index.
-- It intentionally does not create a pass probability without independent calibration.

alter table public.amc_adapter_evaluation
 add column if not exists readiness_index numeric check(readiness_index is null or readiness_index between 0 and 1),
 add column if not exists readiness_index_lower numeric check(readiness_index_lower is null or readiness_index_lower between 0 and 1),
 add column if not exists readiness_index_upper numeric check(readiness_index_upper is null or readiness_index_upper between 0 and 1),
 add column if not exists readiness_basis text,
 add column if not exists model_version text,
 add column if not exists provenance jsonb not null default '{}'::jsonb;

update public.amc_plugin_version
set status='VALIDATING',
    assumptions=jsonb_set(jsonb_set(assumptions,'{readiness_probability_status}','"NOT_CALIBRATED"'::jsonb,true),'{readiness_index_status}','"ENGINEERING_ONLY"'::jsonb,true)
where plugin_code='AMC' and plugin_version='1.0.0';

update public.amc_exam_environment_v1
set status='VALIDATING',
    target_definition=jsonb_set(target_definition,'{pass_probability_calibrated}','false'::jsonb,true)
where plugin_version_id in(select id from public.amc_plugin_version where plugin_code='AMC' and plugin_version='1.0.0');

-- Public RPCs must remain caller-scoped. The implementation reads only the caller's PIE inference.
-- See the deployed P10 live migration for the full function body and the authenticated Edge Function DTO.
