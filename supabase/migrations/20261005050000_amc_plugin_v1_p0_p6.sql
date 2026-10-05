-- AMC Intelligence Plugin v1
-- P0-P6: contract, blueprint, taxonomy, question context, environment,
-- readiness adapter, decision/DWIG context, intervention catalogue.
--
-- Security contract:
-- 1. AMC intelligence tables are internal by default.
-- 2. Candidate clients do not receive direct SELECT/INSERT/UPDATE/DELETE.
-- 3. Service-role Edge Functions are the only runtime access path.
-- 4. Candidate-facing responses must be allow-listed DTOs.
-- 5. AMC configuration is versioned and never becomes PIE mathematics.
-- 6. Question statistical state remains owned by PIE/question intelligence.
-- 7. Candidate state remains exam-neutral.

CREATE TABLE IF NOT EXISTS public.amc_plugin_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_code TEXT NOT NULL,
  plugin_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DEVELOPMENT'
    CHECK (status IN ('DEVELOPMENT','VALIDATING','ACTIVE','RETIRED','REJECTED')),
  contract_version TEXT NOT NULL,
  blueprint_version TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL,
  environment_version TEXT NOT NULL,
  target_version TEXT NOT NULL,
  model_family TEXT NOT NULL,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT amc_plugin_version_unique UNIQUE(plugin_code, plugin_version)
);

CREATE TABLE IF NOT EXISTS public.amc_blueprint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  exam_mode TEXT NOT NULL CHECK (exam_mode IN ('MCQ','CLINICAL')),
  blueprint_version TEXT NOT NULL,
  patient_group TEXT NOT NULL,
  task_domain TEXT,
  proportion NUMERIC CHECK (proportion IS NULL OR proportion >= 0 AND proportion <= 1),
  item_target INTEGER CHECK (item_target IS NULL OR item_target > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plugin_version_id, exam_mode, blueprint_version, patient_group, task_domain)
);

CREATE TABLE IF NOT EXISTS public.amc_task_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  exam_mode TEXT NOT NULL CHECK (exam_mode IN ('MCQ','CLINICAL')),
  code TEXT NOT NULL,
  parent_code TEXT,
  label TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plugin_version_id, exam_mode, code)
);

CREATE TABLE IF NOT EXISTS public.amc_question_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  question_id UUID NOT NULL,
  question_version TEXT NOT NULL,
  exam_mode TEXT NOT NULL CHECK (exam_mode IN ('MCQ','CLINICAL')),
  patient_group TEXT,
  clinical_domain TEXT,
  task_type TEXT,
  cognitive_demand TEXT,
  question_family TEXT,
  novelty_class TEXT,
  amc_relevance TEXT,
  source_evidence_level TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plugin_version_id, question_id, question_version)
);

CREATE TABLE IF NOT EXISTS public.amc_exam_environment_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  exam_mode TEXT NOT NULL CHECK (exam_mode IN ('MCQ','CLINICAL')),
  environment_code TEXT NOT NULL,
  environment_version TEXT NOT NULL,
  blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
  timing JSONB NOT NULL DEFAULT '{}'::jsonb,
  task_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
  difficulty_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  source_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DEVELOPMENT'
    CHECK (status IN ('DEVELOPMENT','VALIDATING','ACTIVE','RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plugin_version_id, environment_code, environment_version)
);

CREATE TABLE IF NOT EXISTS public.amc_adapter_evaluation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  environment_id UUID NOT NULL REFERENCES public.amc_exam_environment_v1(id) ON DELETE RESTRICT,
  candidate_state_id UUID REFERENCES public.pie_candidate_state(id) ON DELETE SET NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_probability NUMERIC CHECK (target_probability IS NULL OR target_probability BETWEEN 0 AND 1),
  lower_bound NUMERIC CHECK (lower_bound IS NULL OR lower_bound BETWEEN 0 AND 1),
  upper_bound NUMERIC CHECK (upper_bound IS NULL OR upper_bound BETWEEN 0 AND 1),
  uncertainty_measure NUMERIC CHECK (uncertainty_measure IS NULL OR uncertainty_measure >= 0),
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  evidence_quality NUMERIC CHECK (evidence_quality IS NULL OR evidence_quality BETWEEN 0 AND 1),
  identification_status TEXT NOT NULL DEFAULT 'UNRESOLVED'
    CHECK (identification_status IN ('UNRESOLVED','PROVISIONALLY_IDENTIFIED','IDENTIFIED_FOR_DECISION')),
  readiness_status TEXT NOT NULL DEFAULT 'INSUFFICIENT_EVIDENCE'
    CHECK (readiness_status IN ('INSUFFICIENT_EVIDENCE','ESTIMATE_AVAILABLE','DECISION_STABLE')),
  state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  adapter_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.amc_dwig_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  environment_id UUID NOT NULL REFERENCES public.amc_exam_environment_v1(id) ON DELETE RESTRICT,
  decision_context TEXT NOT NULL,
  pie_dwig_candidate_id UUID REFERENCES public.pie_dwig_candidate(id) ON DELETE SET NULL,
  selected_question_id UUID,
  selected_task_code TEXT,
  expected_decision_uncertainty_reduction NUMERIC CHECK (expected_decision_uncertainty_reduction IS NULL OR expected_decision_uncertainty_reduction >= 0),
  selection_uncertainty NUMERIC CHECK (selection_uncertainty IS NULL OR selection_uncertainty >= 0),
  rationale JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.amc_intervention_catalog_v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  intervention_code TEXT NOT NULL,
  label TEXT NOT NULL,
  target_states TEXT[] NOT NULL DEFAULT '{}',
  eligible_exam_modes TEXT[] NOT NULL DEFAULT '{}',
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('QUESTION_SET','TIMED_BLOCK','REVIEW','PERTURBATION','CLINICAL_TASK','SIMULATION','OTHER')),
  outcome_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_level TEXT NOT NULL DEFAULT 'UNVALIDATED',
  active BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plugin_version_id, intervention_code)
);

CREATE INDEX IF NOT EXISTS amc_blueprint_lookup_idx ON public.amc_blueprint(plugin_version_id, exam_mode);
CREATE INDEX IF NOT EXISTS amc_taxonomy_lookup_idx ON public.amc_task_taxonomy(plugin_version_id, exam_mode, code);
CREATE INDEX IF NOT EXISTS amc_question_context_lookup_idx ON public.amc_question_context(plugin_version_id, question_id);
CREATE INDEX IF NOT EXISTS amc_environment_lookup_idx ON public.amc_exam_environment_v1(plugin_version_id, exam_mode, status);
CREATE INDEX IF NOT EXISTS amc_adapter_user_time_idx ON public.amc_adapter_evaluation(user_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS amc_dwig_user_time_idx ON public.amc_dwig_context(user_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'amc_plugin_version','amc_blueprint','amc_task_taxonomy',
    'amc_question_context','amc_exam_environment_v1',
    'amc_adapter_evaluation','amc_dwig_context','amc_intervention_catalog_v1'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'amc_plugin_version','amc_blueprint','amc_task_taxonomy',
    'amc_question_context','amc_exam_environment_v1',
    'amc_adapter_evaluation','amc_dwig_context','amc_intervention_catalog_v1'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t || '_service_all', t);
  END LOOP;
END $$;

INSERT INTO public.amc_plugin_version (
  plugin_code, plugin_version, status, contract_version, blueprint_version,
  taxonomy_version, environment_version, target_version, model_family,
  assumptions, source_manifest
)
VALUES (
  'AMC', '1.0.0', 'DEVELOPMENT', '1.0.0', '2026.1', '1.0.0', '1.0.0', '1.0.0',
  'hierarchical_dynamic_state_space',
  jsonb_build_object(
    'exam_neutral_core', true,
    'readiness_is_exam_conditional', true,
    'fixed_pie_weights', false,
    'candidate_direct_table_access', false,
    'question_parameters_owned_by_pie', true,
    'causal_intervention_claims', false
  ),
  jsonb_build_array(
    jsonb_build_object('source','AMC MCQ Examination Specifications V8','url','https://www.amc.org.au/wp-content/uploads/2025/09/2025-09-09-MCQ-Specifications-V8.pdf'),
    jsonb_build_object('source','AMC Clinical Examination page','url','https://www.amc.org.au/pathways/standard-pathway/amc-assessments/clinical-examination/'),
    jsonb_build_object('source','AMC Assessment Domains','url','https://www.amc.org.au/resources-for-examination-preparation/assessment-domains/')
  )
)
ON CONFLICT (plugin_code, plugin_version) DO NOTHING;

WITH p AS (
  SELECT id FROM public.amc_plugin_version WHERE plugin_code='AMC' AND plugin_version='1.0.0'
)
INSERT INTO public.amc_blueprint (plugin_version_id, exam_mode, blueprint_version, patient_group, proportion, item_target, metadata)
SELECT p.id,'MCQ','2026.1',v.patient_group,v.proportion,NULL,v.metadata
FROM p CROSS JOIN (VALUES
  ('ADULT_MEDICINE',0.30,jsonb_build_object('source','AMC V8')),
  ('ADULT_SURGERY',0.20,jsonb_build_object('source','AMC V8')),
  ('WOMENS_HEALTH',0.125,jsonb_build_object('source','AMC V8')),
  ('CHILD_HEALTH',0.125,jsonb_build_object('source','AMC V8')),
  ('MENTAL_HEALTH',0.125,jsonb_build_object('source','AMC V8')),
  ('POPULATION_HEALTH',0.125,jsonb_build_object('source','AMC V8'))
) AS v(patient_group,proportion,metadata)
ON CONFLICT DO NOTHING;

WITH p AS (
  SELECT id FROM public.amc_plugin_version WHERE plugin_code='AMC' AND plugin_version='1.0.0'
)
INSERT INTO public.amc_blueprint (plugin_version_id, exam_mode, blueprint_version, patient_group, task_domain, metadata)
SELECT p.id,'CLINICAL','2026.1',v.patient_group,v.task_domain,v.metadata
FROM p CROSS JOIN (VALUES
  ('ADULT_MEDICINE','HISTORY',jsonb_build_object('source','AMC Clinical Examination')),
  ('ADULT_MEDICINE','EXAMINATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('ADULT_MEDICINE','DIAGNOSTIC_FORMULATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('ADULT_MEDICINE','MANAGEMENT_COUNSELLING_EDUCATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('ADULT_SURGERY','HISTORY',jsonb_build_object('source','AMC Clinical Examination')),
  ('ADULT_SURGERY','EXAMINATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('ADULT_SURGERY','DIAGNOSTIC_FORMULATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('ADULT_SURGERY','MANAGEMENT_COUNSELLING_EDUCATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('WOMENS_HEALTH','HISTORY',jsonb_build_object('source','AMC Clinical Examination')),
  ('WOMENS_HEALTH','EXAMINATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('WOMENS_HEALTH','DIAGNOSTIC_FORMULATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('WOMENS_HEALTH','MANAGEMENT_COUNSELLING_EDUCATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('CHILD_HEALTH','HISTORY',jsonb_build_object('source','AMC Clinical Examination')),
  ('CHILD_HEALTH','EXAMINATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('CHILD_HEALTH','DIAGNOSTIC_FORMULATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('CHILD_HEALTH','MANAGEMENT_COUNSELLING_EDUCATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('MENTAL_HEALTH','HISTORY',jsonb_build_object('source','AMC Clinical Examination')),
  ('MENTAL_HEALTH','EXAMINATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('MENTAL_HEALTH','DIAGNOSTIC_FORMULATION',jsonb_build_object('source','AMC Clinical Examination')),
  ('MENTAL_HEALTH','MANAGEMENT_COUNSELLING_EDUCATION',jsonb_build_object('source','AMC Clinical Examination'))
) AS v(patient_group,task_domain,metadata)
ON CONFLICT DO NOTHING;

WITH p AS (
 SELECT id FROM public.amc_plugin_version WHERE plugin_code='AMC' AND plugin_version='1.0.0'
)
INSERT INTO public.amc_task_taxonomy (plugin_version_id,exam_mode,code,label,description,metadata)
SELECT p.id,v.exam_mode,v.code,v.label,v.description,v.metadata
FROM p CROSS JOIN (VALUES
 ('MCQ','DISEASE_PROCESS','Disease process','Disease process and pathophysiology',jsonb_build_object('source','AMC MCQ')),
 ('MCQ','CLINICAL_EXAMINATION_DIAGNOSIS','Clinical examination and diagnosis','Clinical assessment and diagnostic reasoning',jsonb_build_object('source','AMC MCQ')),
 ('MCQ','INVESTIGATION','Investigation','Investigation selection and interpretation',jsonb_build_object('source','AMC MCQ')),
 ('MCQ','THERAPY_MANAGEMENT','Therapy and management','Treatment and management decisions',jsonb_build_object('source','AMC MCQ')),
 ('MCQ','AUSTRALIAN_POPULATION_HEALTH','Population health','Population health and Australian context',jsonb_build_object('source','AMC MCQ')),
 ('CLINICAL','HISTORY','History','History taking',jsonb_build_object('source','AMC Clinical')),
 ('CLINICAL','EXAMINATION','Examination','Choice, technique and accuracy of examination',jsonb_build_object('source','AMC Clinical')),
 ('CLINICAL','DIAGNOSTIC_FORMULATION','Diagnostic formulation','Diagnosis and differential diagnosis',jsonb_build_object('source','AMC Clinical')),
 ('CLINICAL','MANAGEMENT_COUNSELLING_EDUCATION','Management/counselling/education','Management, counselling and education',jsonb_build_object('source','AMC Clinical')),
 ('CLINICAL','COMMUNICATION','Communication','Approach, empathy, autonomy, cultural sensitivity and patient understanding',jsonb_build_object('source','AMC Assessment Domains')),
 ('CLINICAL','INVESTIGATION_INTERPRETATION','Investigation interpretation','Interpretation of investigations in clinical decision making',jsonb_build_object('source','AMC Assessment Domains'))
) AS v(exam_mode,code,label,description,metadata)
ON CONFLICT DO NOTHING;

WITH p AS (
 SELECT id FROM public.amc_plugin_version WHERE plugin_code='AMC' AND plugin_version='1.0.0'
)
INSERT INTO public.amc_exam_environment_v1 (
 plugin_version_id,exam_mode,environment_code,environment_version,blueprint,timing,task_mix,target_definition,duration_seconds,source_manifest,status
)
SELECT p.id,'MCQ','AMC_CAT_MCQ','2026.1',
 jsonb_build_object('items',150,'patient_group_blueprint','AMC_V8'),
 jsonb_build_object('duration_hours',3.5,'duration_seconds',12600,'adaptive',true,'review_model','end_of_exam_review'),
 jsonb_build_object('question_type','A_TYPE','options',5),
 jsonb_build_object('target','exam_standard','target_type','PASS_STANDARD'),
 12600,
 jsonb_build_array('AMC MCQ Examination Specifications V8'),
 'DEVELOPMENT'
FROM p
ON CONFLICT DO NOTHING;

INSERT INTO public.amc_exam_environment_v1 (
 plugin_version_id,exam_mode,environment_code,environment_version,blueprint,timing,task_mix,target_definition,duration_seconds,source_manifest,status
)
SELECT p.id,'CLINICAL','AMC_CLINICAL','2026.1',
 jsonb_build_object('assessed_stations',16,'rest_stations',4),
 jsonb_build_object('station_minutes',10,'reading_minutes',2,'assessment_minutes',8),
 jsonb_build_object('predominant_assessment_areas',jsonb_build_array('HISTORY','EXAMINATION','DIAGNOSTIC_FORMULATION','MANAGEMENT_COUNSELLING_EDUCATION')),
 jsonb_build_object('target','clinical_exam_standard','target_type','PASS_STANDARD'),
 12000,
 jsonb_build_array('AMC Clinical Examination page','AMC Assessment Domains'),
 'DEVELOPMENT'
FROM p
ON CONFLICT DO NOTHING;

WITH p AS (
 SELECT id FROM public.amc_plugin_version WHERE plugin_code='AMC' AND plugin_version='1.0.0'
)
INSERT INTO public.amc_intervention_catalog_v1
(plugin_version_id,intervention_code,label,target_states,eligible_exam_modes,delivery_type,outcome_definition,evidence_level,active)
SELECT p.id,v.code,v.label,v.states,v.modes,v.delivery,v.outcome,'UNVALIDATED',false
FROM p CROSS JOIN (VALUES
 ('AMC_TIMED_MCQ_BLOCK','Timed AMC-style MCQ block',ARRAY['TIMING','SUSTAINED_PERFORMANCE']::text[],ARRAY['MCQ']::text[],'TIMED_BLOCK',jsonb_build_object('primary','change_in_timing_and_residual_performance')),
 ('AMC_DECISION_REVIEW','Answer-decision review task',ARRAY['DECISION']::text[],ARRAY['MCQ']::text[],'REVIEW',jsonb_build_object('primary','change_in_answer_change_and_decision_quality')),
 ('AMC_CALIBRATION_SET','Confidence-calibration MCQ set',ARRAY['CALIBRATION']::text[],ARRAY['MCQ']::text[],'QUESTION_SET',jsonb_build_object('primary','change_in_calibration_metrics')),
 ('AMC_NOVEL_TRANSFER','Novel transfer set',ARRAY['CAPABILITY','LEARNING']::text[],ARRAY['MCQ']::text[],'QUESTION_SET',jsonb_build_object('primary','transfer_performance')),
 ('AMC_CLINICAL_STATION','AMC clinical task station',ARRAY['CAPABILITY','DECISION','CALIBRATION']::text[],ARRAY['CLINICAL']::text[],'CLINICAL_TASK',jsonb_build_object('primary','domain_performance_change')),
 ('AMC_SUSTAINED_CLINICAL_BLOCK','Timed clinical station sequence',ARRAY['SUSTAINED_PERFORMANCE','TIMING']::text[],ARRAY['CLINICAL']::text[],'SIMULATION',jsonb_build_object('primary','late_vs_early_residual_change'))
) AS v(code,label,states,modes,delivery,outcome)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.amc_plugin_version IS 'AMC plugin contract and provenance. Not PIE mathematics.';
COMMENT ON TABLE public.amc_blueprint IS 'Versioned AMC content distribution. Blueprint values are exam metadata, not candidate-state weights.';
COMMENT ON TABLE public.amc_question_context IS 'AMC semantic context for questions. Statistical question state remains in PIE.';
COMMENT ON TABLE public.amc_adapter_evaluation IS 'AMC-specific output of exam adapter. Never a latent core candidate state.';
COMMENT ON TABLE public.amc_dwig_context IS 'AMC context around PIE DWIG selection. Does not replace PIE decision mathematics.';
