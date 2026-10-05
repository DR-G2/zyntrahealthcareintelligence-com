-- PIE v1.0 P0.6: validation registry
-- Purpose: make every PIE model/inference claim traceable to a validation run.
-- This is a registry only. It does not certify or activate a model.

CREATE TABLE IF NOT EXISTS public.pie_validation_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  model_version TEXT NOT NULL,

  validation_run_code TEXT NOT NULL,
  validation_level TEXT NOT NULL
    CHECK (
      validation_level IN (
        'SANITY',
        'MEASUREMENT',
        'DECISION',
        'INTERVENTION'
      )
    ),

  status TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (
      status IN (
        'PLANNED',
        'RUNNING',
        'PASSED',
        'FAILED',
        'INCONCLUSIVE',
        'REJECTED'
      )
    ),

  dataset_version TEXT,
  generator_version TEXT,

  seed INTEGER,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  sample_count INTEGER
    CHECK (sample_count IS NULL OR sample_count >= 0),

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_validation_run_code_unique
    UNIQUE (validation_run_code)
);

COMMENT ON TABLE public.pie_validation_run IS
  'Registry of PIE validation runs. Validation evidence is separate from model implementation and activation.';

COMMENT ON COLUMN public.pie_validation_run.validation_level IS
  'SANITY checks basic system behaviour; MEASUREMENT checks state recovery and uncertainty; DECISION checks decision quality; INTERVENTION checks intervention/causal claims.';

COMMENT ON COLUMN public.pie_validation_run.generator_version IS
  'Synthetic-data generator version when synthetic validation is used.';

CREATE INDEX IF NOT EXISTS pie_validation_run_model_idx
  ON public.pie_validation_run (model_version, created_at DESC);

CREATE INDEX IF NOT EXISTS pie_validation_run_status_idx
  ON public.pie_validation_run (status);

ALTER TABLE public.pie_validation_run ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_validation_run_service_select ON public.pie_validation_run;
CREATE POLICY pie_validation_run_service_select
  ON public.pie_validation_run
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_validation_run_service_insert ON public.pie_validation_run;
CREATE POLICY pie_validation_run_service_insert
  ON public.pie_validation_run
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_validation_run_service_update ON public.pie_validation_run;
CREATE POLICY pie_validation_run_service_update
  ON public.pie_validation_run
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_validation_run_service_delete ON public.pie_validation_run;
CREATE POLICY pie_validation_run_service_delete
  ON public.pie_validation_run
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_validation_metric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  validation_run_id UUID NOT NULL
    REFERENCES public.pie_validation_run(id) ON DELETE CASCADE,

  metric_code TEXT NOT NULL,
  metric_family TEXT NOT NULL,

  value NUMERIC,
  lower_bound NUMERIC,
  upper_bound NUMERIC,

  unit TEXT,

  direction TEXT
    CHECK (
      direction IS NULL
      OR direction IN ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET_RANGE')
    ),

  target_description TEXT,

  metric_version TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_validation_metric_unique
    UNIQUE (validation_run_id, metric_code, metric_version)
);

COMMENT ON TABLE public.pie_validation_metric IS
  'Measured validation results. A metric is evidence for a validation run, not a model parameter.';

COMMENT ON COLUMN public.pie_validation_metric.target_description IS
  'Human-readable validation criterion. Numeric pass thresholds are not hard-coded by the PIE schema.';

CREATE INDEX IF NOT EXISTS pie_validation_metric_run_idx
  ON public.pie_validation_metric (validation_run_id);

CREATE INDEX IF NOT EXISTS pie_validation_metric_family_idx
  ON public.pie_validation_metric (metric_family);

ALTER TABLE public.pie_validation_metric ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_validation_metric_service_select ON public.pie_validation_metric;
CREATE POLICY pie_validation_metric_service_select
  ON public.pie_validation_metric
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_validation_metric_service_insert ON public.pie_validation_metric;
CREATE POLICY pie_validation_metric_service_insert
  ON public.pie_validation_metric
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_validation_metric_service_update ON public.pie_validation_metric;
CREATE POLICY pie_validation_metric_service_update
  ON public.pie_validation_metric
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_validation_metric_service_delete ON public.pie_validation_metric;
CREATE POLICY pie_validation_metric_service_delete
  ON public.pie_validation_metric
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_validation_claim (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  validation_run_id UUID NOT NULL
    REFERENCES public.pie_validation_run(id) ON DELETE CASCADE,

  claim_code TEXT NOT NULL,

  claim_type TEXT NOT NULL
    CHECK (
      claim_type IN (
        'MEASUREMENT_VALIDITY',
        'PREDICTIVE_VALIDITY',
        'DECISION_VALIDITY',
        'CAUSAL_VALIDITY',
        'GENERALIZATION',
        'ROBUSTNESS'
      )
    ),

  claim_text TEXT NOT NULL,

  evidence_summary TEXT,

  status TEXT NOT NULL DEFAULT 'UNRESOLVED'
    CHECK (
      status IN (
        'UNRESOLVED',
        'SUPPORTED',
        'PARTIALLY_SUPPORTED',
        'NOT_SUPPORTED',
        'REJECTED'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_validation_claim_unique
    UNIQUE (validation_run_id, claim_code)
);

COMMENT ON TABLE public.pie_validation_claim IS
  'Explicit claims and their validation status. PIE must not convert a metric into a stronger scientific claim than the evidence supports.';

CREATE INDEX IF NOT EXISTS pie_validation_claim_run_idx
  ON public.pie_validation_claim (validation_run_id);

CREATE INDEX IF NOT EXISTS pie_validation_claim_type_idx
  ON public.pie_validation_claim (claim_type);

ALTER TABLE public.pie_validation_claim ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_validation_claim_service_select ON public.pie_validation_claim;
CREATE POLICY pie_validation_claim_service_select
  ON public.pie_validation_claim
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_validation_claim_service_insert ON public.pie_validation_claim;
CREATE POLICY pie_validation_claim_service_insert
  ON public.pie_validation_claim
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_validation_claim_service_update ON public.pie_validation_claim;
CREATE POLICY pie_validation_claim_service_update
  ON public.pie_validation_claim
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_validation_claim_service_delete ON public.pie_validation_claim;
CREATE POLICY pie_validation_claim_service_delete
  ON public.pie_validation_claim
  FOR DELETE
  TO service_role
  USING (true);

-- P0.6 intentionally has no automatic PASS/CERTIFIED trigger.
-- Certification is a controlled model-governance action after validation evidence
-- has been reviewed.