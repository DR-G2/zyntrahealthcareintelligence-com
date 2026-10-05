-- P7 external validation registry for AMC Plugin v1.
CREATE TABLE IF NOT EXISTS public.amc_validation_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  validation_type TEXT NOT NULL CHECK (validation_type IN ('AMC_SPEC','BLUEPRINT','PSYCHOMETRIC_EXTERNAL','SYNTHETIC','SECURITY','INTEGRATION')),
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','RUNNING','PASSED','FAILED','INCONCLUSIVE','REJECTED')),
  source TEXT,
  source_version TEXT,
  dataset_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  methodology JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.amc_validation_metric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id UUID NOT NULL REFERENCES public.amc_validation_run(id) ON DELETE CASCADE,
  metric_code TEXT NOT NULL,
  observed_value NUMERIC,
  expected_value NUMERIC,
  tolerance NUMERIC,
  direction TEXT CHECK (direction IN ('LOWER_IS_BETTER','HIGHER_IS_BETTER','TARGET_RANGE','EQUALITY')),
  status TEXT NOT NULL CHECK (status IN ('PASS','FAIL','INCONCLUSIVE','NOT_APPLICABLE')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.amc_validation_claim (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id UUID NOT NULL REFERENCES public.amc_validation_run(id) ON DELETE CASCADE,
  claim_code TEXT NOT NULL,
  claim TEXT NOT NULL,
  evidence_level TEXT NOT NULL CHECK (evidence_level IN ('SOURCE','ENGINEERING','SYNTHETIC','EXTERNAL','EMPIRICAL')),
  status TEXT NOT NULL CHECK (status IN ('SUPPORTED','UNSUPPORTED','INCONCLUSIVE','REJECTED')),
  limitations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.amc_validation_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_validation_metric ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_validation_claim ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amc_validation_run, public.amc_validation_metric, public.amc_validation_claim FROM anon, authenticated;
GRANT ALL ON public.amc_validation_run, public.amc_validation_metric, public.amc_validation_claim TO service_role;
DROP POLICY IF EXISTS amc_validation_run_service_all ON public.amc_validation_run;
DROP POLICY IF EXISTS amc_validation_metric_service_all ON public.amc_validation_metric;
DROP POLICY IF EXISTS amc_validation_claim_service_all ON public.amc_validation_claim;
CREATE POLICY amc_validation_run_service_all ON public.amc_validation_run FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY amc_validation_metric_service_all ON public.amc_validation_metric FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY amc_validation_claim_service_all ON public.amc_validation_claim FOR ALL TO service_role USING (true) WITH CHECK (true);
