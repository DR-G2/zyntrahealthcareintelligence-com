CREATE TABLE IF NOT EXISTS public.pie_intervention_causal_evidence (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 intervention_id UUID NOT NULL,
 design TEXT NOT NULL CHECK (design IN ('DESCRIPTIVE','QUASI_EXPERIMENTAL','RANDOMIZED')),
 estimand TEXT NOT NULL,
 effect_estimate NUMERIC,
 uncertainty NUMERIC,
 sample_size INTEGER NOT NULL DEFAULT 0 CHECK(sample_size>=0),
 confounding_risk NUMERIC NOT NULL DEFAULT 1 CHECK(confounding_risk BETWEEN 0 AND 1),
 outcome_quality NUMERIC NOT NULL DEFAULT 0 CHECK(outcome_quality BETWEEN 0 AND 1),
 causal_status TEXT NOT NULL CHECK(causal_status IN ('NOT_CAUSAL','PRELIMINARY_CAUSAL','CAUSAL')),
 model_version TEXT NOT NULL,
 validation_run_id UUID,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pie_intervention_causal_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pie_intervention_causal_evidence_service_all ON public.pie_intervention_causal_evidence;
CREATE POLICY pie_intervention_causal_evidence_service_all ON public.pie_intervention_causal_evidence
 FOR ALL TO service_role USING(true) WITH CHECK(true);
COMMENT ON TABLE public.pie_intervention_causal_evidence IS
 'Internal causal evidence provenance. Candidate-facing readiness must not read this table.';
