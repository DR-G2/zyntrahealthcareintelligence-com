-- P1: AMC blueprint and task taxonomy registry.
-- Official proportions are deliberately not invented here.
do $$
declare v_plugin uuid;
declare v_env uuid;
begin
  select id into v_plugin from public.amc_plugin_version where plugin_key='AMC_EXAM_INTELLIGENCE' and plugin_version='1.0.0';
  insert into public.amc_exam_environment
    (plugin_version_id, environment_key, environment_version, blueprint_version, task_mix_version, timing_version, target_version, metadata)
  values
    (v_plugin,'AMC_MCQ','1.0','UNPOPULATED_1.0','UNPOPULATED_1.0','UNPOPULATED_1.0','UNPOPULATED_1.0',jsonb_build_object('status','development','official_values_required',true))
  on conflict (plugin_version_id, environment_key, environment_version) do nothing;
  select id into v_env from public.amc_exam_environment where plugin_version_id=v_plugin and environment_key='AMC_MCQ' and environment_version='1.0';
  insert into public.amc_blueprint_dimension(environment_id,dimension_key,parent_dimension_key,label,display_order)
  values
    (v_env,'ADULT_MEDICINE',null,'Adult Medicine',10),
    (v_env,'ADULT_SURGERY',null,'Adult Surgery',20),
    (v_env,'CHILD_HEALTH',null,'Child Health',30),
    (v_env,'WOMENS_HEALTH',null,'Women''s Health',40),
    (v_env,'MENTAL_HEALTH',null,'Mental Health',50),
    (v_env,'EMERGENCY_ACUTE',null,'Emergency and Acute Presentations',60),
    (v_env,'CROSS_DISCIPLINARY',null,'Cross-disciplinary',70)
  on conflict (environment_id,dimension_key) do nothing;
  insert into public.amc_task_taxonomy(plugin_version_id,task_key,task_group,label,description,version)
  values
    (v_plugin,'DIAGNOSIS','CLINICAL_REASONING','Diagnosis','Select the most appropriate diagnosis or diagnostic conclusion.','1.0'),
    (v_plugin,'MANAGEMENT','CLINICAL_REASONING','Management','Select the most appropriate management or next step.','1.0'),
    (v_plugin,'INVESTIGATION','CLINICAL_REASONING','Investigation','Select the most appropriate investigation or interpretation.','1.0'),
    (v_plugin,'EMERGENCY','ACUTE_CARE','Emergency care','Recognise and manage an acute presentation.','1.0'),
    (v_plugin,'PREVENTION','PREVENTION','Prevention','Apply prevention, screening, or risk-reduction reasoning.','1.0'),
    (v_plugin,'COMMUNICATION','PROFESSIONAL','Communication','Apply clinically appropriate communication or professional reasoning.','1.0')
  on conflict (plugin_version_id,task_key,version) do nothing;
end $$;
