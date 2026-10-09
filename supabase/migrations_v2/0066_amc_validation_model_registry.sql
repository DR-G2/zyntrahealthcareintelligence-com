-- P4 certification storage. A metrics row is not enough to promote a model:
-- both the empirical gate and the separate readiness-runtime guard must pass.

CREATE TABLE IF NOT EXISTS public.amc_validation_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  dataset_id TEXT NOT NULL,
  dataset_approved BOOLEAN NOT NULL DEFAULT false,
  independent_calibration_complete BOOLEAN NOT NULL DEFAULT false,
  holdout_complete BOOLEAN NOT NULL DEFAULT false,
  external_review_complete BOOLEAN NOT NULL DEFAULT false,
  candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  holdout_count INTEGER NOT NULL DEFAULT 0 CHECK (holdout_count >= 0),
  spearman_theta NUMERIC,
  brier NUMERIC CHECK (brier IS NULL OR brier BETWEEN 0 AND 1),
  auc NUMERIC CHECK (auc IS NULL OR auc BETWEEN 0 AND 1),
  ece NUMERIC CHECK (ece IS NULL OR ece BETWEEN 0 AND 1),
  log_loss NUMERIC CHECK (log_loss IS NULL OR log_loss >= 0),
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  gate_status TEXT NOT NULL DEFAULT 'BLOCKED'
    CHECK (gate_status IN ('BLOCKED','ELIGIBLE','PROMOTED','REJECTED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.amc_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  model_version TEXT NOT NULL,
  model_type TEXT NOT NULL,
  calibration_run_id UUID REFERENCES public.amc_validation_run(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'SHADOW'
    CHECK (status IN ('DRAFT','SHADOW','ACTIVE','RETIRED')),
  pass_probability_calibrated BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(plugin_version_id, model_version)
);

CREATE INDEX IF NOT EXISTS amc_validation_run_plugin_created_idx
  ON public.amc_validation_run(plugin_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS amc_model_registry_plugin_status_idx
  ON public.amc_model_registry(plugin_version_id, status);

ALTER TABLE public.amc_validation_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_model_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amc_validation_run FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.amc_model_registry FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.amc_validation_run TO service_role;
GRANT ALL ON public.amc_model_registry TO service_role;

DROP POLICY IF EXISTS amc_validation_run_service_all ON public.amc_validation_run;
CREATE POLICY amc_validation_run_service_all
  ON public.amc_validation_run FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS amc_model_registry_service_all ON public.amc_model_registry;
CREATE POLICY amc_model_registry_service_all
  ON public.amc_model_registry FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.amc_evaluate_promotion_gate(p_validation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run record;
  v_pass boolean;
  v_reasons jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_run FROM public.amc_validation_run WHERE id = p_validation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'validation run not found'; END IF;

  v_pass := v_run.dataset_approved
    AND v_run.independent_calibration_complete
    AND v_run.holdout_complete
    AND v_run.external_review_complete
    AND v_run.candidate_count >= 1000
    AND v_run.holdout_count >= 200
    AND coalesce(v_run.spearman_theta, 0) >= 0.75
    AND coalesce(v_run.brier, 1) <= 0.18
    AND coalesce(v_run.auc, 0) >= 0.75
    AND coalesce(v_run.ece, 1) <= 0.05
    AND coalesce(v_run.log_loss, 1) <= 0.60;

  IF NOT v_run.dataset_approved THEN v_reasons := v_reasons || '["dataset_not_approved"]'::jsonb; END IF;
  IF NOT v_run.independent_calibration_complete THEN v_reasons := v_reasons || '["independent_calibration_incomplete"]'::jsonb; END IF;
  IF NOT v_run.holdout_complete THEN v_reasons := v_reasons || '["holdout_incomplete"]'::jsonb; END IF;
  IF NOT v_run.external_review_complete THEN v_reasons := v_reasons || '["external_review_incomplete"]'::jsonb; END IF;
  IF v_run.candidate_count < 1000 THEN v_reasons := v_reasons || '["insufficient_candidates"]'::jsonb; END IF;
  IF v_run.holdout_count < 200 THEN v_reasons := v_reasons || '["insufficient_holdout"]'::jsonb; END IF;
  IF coalesce(v_run.spearman_theta, 0) < 0.75 THEN v_reasons := v_reasons || '["rank_recovery_below_threshold"]'::jsonb; END IF;
  IF coalesce(v_run.brier, 1) > 0.18 THEN v_reasons := v_reasons || '["brier_above_threshold"]'::jsonb; END IF;
  IF coalesce(v_run.auc, 0) < 0.75 THEN v_reasons := v_reasons || '["auc_below_threshold"]'::jsonb; END IF;
  IF coalesce(v_run.ece, 1) > 0.05 THEN v_reasons := v_reasons || '["ece_above_threshold"]'::jsonb; END IF;
  IF coalesce(v_run.log_loss, 1) > 0.60 THEN v_reasons := v_reasons || '["log_loss_above_threshold"]'::jsonb; END IF;

  UPDATE public.amc_validation_run
  SET gate_status = CASE WHEN v_pass THEN 'ELIGIBLE' ELSE 'BLOCKED' END,
      reviewed_at = now()
  WHERE id = p_validation_id;

  RETURN jsonb_build_object('eligible', v_pass, 'reasons', v_reasons);
END;
$$;

REVOKE ALL ON FUNCTION public.amc_evaluate_promotion_gate(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amc_evaluate_promotion_gate(uuid) TO service_role;

COMMENT ON TABLE public.amc_validation_run IS
'Restricted empirical validation evidence. No row is sufficient for promotion without all gate criteria.';
COMMENT ON TABLE public.amc_model_registry IS
'Restricted model registry. A calibrated model may activate only through the guarded promotion function.';
