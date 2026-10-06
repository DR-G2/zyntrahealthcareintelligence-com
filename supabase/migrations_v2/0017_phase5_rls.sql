-- Zyntra V2 Phase 5 / RLS for PIE and AMC
-- Default deny for privileged schemas. Service-role/server functions are the intended writers.

alter table pie.pie_model_version enable row level security;
alter table pie.pie_observation enable row level security;
alter table pie.pie_inference_run enable row level security;
alter table pie.pie_candidate_state enable row level security;
alter table pie.pie_state_uncertainty enable row level security;
alter table pie.pie_dynamic_state enable row level security;
alter table pie.pie_dynamic_observation enable row level security;
alter table pie.pie_question_state enable row level security;
alter table pie.pie_question_uncertainty enable row level security;
alter table pie.pie_identifiability enable row level security;
alter table pie.pie_hypothesis enable row level security;
alter table pie.pie_question_quarantine enable row level security;
alter table pie.pie_validation_run enable row level security;
alter table pie.pie_validation_metric enable row level security;
alter table pie.pie_validation_claim enable row level security;
alter table pie.pie_exam_environment enable row level security;
alter table pie.pie_exam_adapter_snapshot enable row level security;
alter table pie.pie_exam_readiness enable row level security;
alter table pie.pie_dwig_candidate enable row level security;
alter table pie.pie_dwig_selection enable row level security;
alter table pie.pie_dwig_outcome enable row level security;
alter table pie.pie_dwig_evaluation enable row level security;
alter table pie.pie_decision_candidate enable row level security;
alter table pie.pie_decision enable row level security;
alter table pie.pie_decision_outcome enable row level security;
alter table pie.pie_intervention_outcome enable row level security;
alter table pie.pie_intervention_effect_estimate enable row level security;
alter table pie.pie_intervention_causal_evidence enable row level security;
alter table pie.pie_runtime_decision enable row level security;
alter table pie.pie_runtime_gate enable row level security;
alter table pie.pie_shadow_run enable row level security;
alter table pie.pie_certification_gate enable row level security;
alter table pie.pie_legacy_compatibility enable row level security;

alter table amc.amc_plugin_version enable row level security;
alter table amc.amc_blueprint enable row level security;
alter table amc.amc_task_taxonomy enable row level security;
alter table amc.amc_question_context enable row level security;
alter table amc.amc_exam_environment enable row level security;
alter table amc.amc_adapter_evaluation enable row level security;
alter table amc.amc_dwig_context enable row level security;
alter table amc.amc_intervention_catalog enable row level security;
alter table amc.amc_validation_run enable row level security;
alter table amc.amc_validation_metric enable row level security;
alter table amc.amc_validation_claim enable row level security;
alter table amc.amc_certification_gate enable row level security;

create policy pie_candidate_state_own on pie.pie_candidate_state for select using (auth.uid() = user_id);
create policy pie_dynamic_state_own on pie.pie_dynamic_state for select using (auth.uid() = user_id);
create policy pie_exam_environment_own on pie.pie_exam_environment for select using (auth.uid() = user_id);
create policy pie_exam_adapter_snapshot_own on pie.pie_exam_adapter_snapshot for select using (auth.uid() = user_id);
create policy pie_exam_readiness_own on pie.pie_exam_readiness for select using (auth.uid() = user_id);
create policy pie_dwig_candidate_own on pie.pie_dwig_candidate for select using (auth.uid() = user_id);
create policy pie_decision_candidate_own on pie.pie_decision_candidate for select using (auth.uid() = user_id);
create policy pie_runtime_decision_own on pie.pie_runtime_decision for select using (auth.uid() = user_id);

-- No direct learner policies for model, question, validation, quarantine,
-- uncertainty, intervention-effect, certification or AMC configuration tables.
