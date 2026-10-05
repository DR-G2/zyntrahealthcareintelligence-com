-- PIE v1.0 P0.1: model/version registry
-- Purpose: establish immutable version metadata before any PIE inference is introduced.
-- This migration does not replace legacy intelligence and does not create a composite PIE score.

CREATE TABLE IF NOT EXISTS public.pie_model_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  model_family TEXT NOT NULL,
  model_version TEXT NOT NULL,

  state_schema_version TEXT NOT NULL,
  observation_schema_version TEXT NOT NULL,

  question_model_version TEXT,
  exam_adapter_version TEXT,
  policy_version TEXT,

  training_dataset_version TEXT,
  validation_run_id UUID,

  status TEXT NOT NULL DEFAULT 'DEVELOPMENT'
    CHECK (status IN (
      'DEVELOPMENT',
      'VALIDATING',
      'CERTIFIED',
      'ACTIVE',
      'RETIRED',
      'REJECTED'
    )),

  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_model_version_unique
    UNIQUE (model_family, model_version)
);

COMMENT ON TABLE public.pie_model_version IS
  'PIE model registry. Stores version/provenance metadata only. It does not calculate candidate readiness or a composite PIE score.';

COMMENT ON COLUMN public.pie_model_version.model_family IS
  'Named PIE inference family, for example hierarchical_dynamic_state_space.';

COMMENT ON COLUMN public.pie_model_version.model_version IS
  'Immutable semantic version of the inference implementation/specification.';

COMMENT ON COLUMN public.pie_model_version.state_schema_version IS
  'Version of the candidate-state representation used by this model.';

COMMENT ON COLUMN public.pie_model_version.observation_schema_version IS
  'Version of the canonical PIE observation contract used by this model.';

COMMENT ON COLUMN public.pie_model_version.assumptions IS
  'Machine-readable record of model assumptions. Do not store secrets.';

-- No browser/client writes to the registry.
ALTER TABLE public.pie_model_version ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_model_version_authenticated_read ON public.pie_model_version;
CREATE POLICY pie_model_version_authenticated_read
  ON public.pie_model_version
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pie_model_version_service_insert ON public.pie_model_version;
CREATE POLICY pie_model_version_service_insert
  ON public.pie_model_version
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_model_version_service_update ON public.pie_model_version;
CREATE POLICY pie_model_version_service_update
  ON public.pie_model_version
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_model_version_service_delete ON public.pie_model_version;
CREATE POLICY pie_model_version_service_delete
  ON public.pie_model_version
  FOR DELETE
  TO service_role
  USING (true);

-- Seed only the model-family identity. No mathematical parameters or weights are seeded.
INSERT INTO public.pie_model_version (
  model_family,
  model_version,
  state_schema_version,
  observation_schema_version,
  status,
  assumptions
)
VALUES (
  'hierarchical_dynamic_state_space',
  '1.0.0',
  '1.0.0',
  '1.0.0',
  'DEVELOPMENT',
  jsonb_build_object(
    'composite_readiness_score', false,
    'fixed_weights', false,
    'uncertainty_required', true,
    'exam_adapter_required', true,
    'derived_intelligence_client_writable', false
  )
)
ON CONFLICT (model_family, model_version) DO NOTHING;
