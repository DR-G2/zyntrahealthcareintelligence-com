-- P11 certification registry.
CREATE TABLE IF NOT EXISTS public.pie_certification_gate (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 model_version TEXT NOT NULL,
 candidate_model_version TEXT NOT NULL,
 question_model_version TEXT NOT NULL,
 dwig_model_version TEXT NOT NULL,
 intervention_model_version TEXT,
 validation_run_id UUID,
 certification_level TEXT NOT NULL CHECK (certification_level IN ('LEVEL_0_SANITY','LEVEL_1_MEASUREMENT','LEVEL_2_DECISION','LEVEL_3_INTERVENTION')),
 status TEXT NOT NULL CHECK (status IN ('PROPOSED','PASSED','FAILED','BLOCKED','REVOKED')),
 evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
 rejection_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
 certified_by TEXT,
 certified_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pie_certification_gate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pie_certification_gate_service_all ON public.pie_certification_gate;
CREATE POLICY pie_certification_gate_service_all ON public.pie_certification_gate
 FOR ALL TO service_role USING(true) WITH CHECK(true);
COMMENT ON TABLE public.pie_certification_gate IS
 'PIE certification registry. No automatic certification or production promotion is implemented.';

CREATE OR REPLACE FUNCTION public.pie_promotion_allowed(
 p_model_version text,
 p_validation_run_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.pie_certification_gate
   WHERE model_version=p_model_version
     AND validation_run_id=p_validation_run_id
     AND status='PASSED'
     AND certification_level='LEVEL_2_DECISION'
 );
$$;
REVOKE ALL ON FUNCTION public.pie_promotion_allowed(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pie_promotion_allowed(text,uuid) TO service_role;
