CREATE TABLE IF NOT EXISTS public.pie_runtime_decision (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL,
 decision_context TEXT NOT NULL,
 mode TEXT NOT NULL CHECK (mode IN ('SHADOW','DEVELOPMENT','VALIDATING','CERTIFIED')),
 candidate_state_sequence INTEGER,
 candidate_model_version TEXT NOT NULL,
 question_model_version TEXT,
 dwig_model_version TEXT NOT NULL,
 intervention_model_version TEXT,
 selected_question_id UUID,
 selected_question_version TEXT,
 selected_intervention_id UUID,
 uncertainty NUMERIC NOT NULL CHECK (uncertainty >= 0),
 rationale TEXT NOT NULL,
 candidate_facing BOOLEAN NOT NULL DEFAULT false,
 promotion_allowed BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pie_runtime_decision_user_time_idx
 ON public.pie_runtime_decision(user_id,created_at DESC);
ALTER TABLE public.pie_runtime_decision ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pie_runtime_decision_owner_select ON public.pie_runtime_decision;
CREATE POLICY pie_runtime_decision_owner_select ON public.pie_runtime_decision
 FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS pie_runtime_decision_service_all ON public.pie_runtime_decision;
CREATE POLICY pie_runtime_decision_service_all ON public.pie_runtime_decision
 FOR ALL TO service_role USING(true) WITH CHECK(true);

CREATE TABLE IF NOT EXISTS public.pie_runtime_gate (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 gate_name TEXT NOT NULL,
 gate_status TEXT NOT NULL CHECK (gate_status IN ('OPEN','BLOCKED','PASSED','FAILED','INCONCLUSIVE')),
 model_version TEXT NOT NULL,
 validation_run_id UUID,
 decision_reason TEXT,
 evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pie_runtime_gate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pie_runtime_gate_service_all ON public.pie_runtime_gate;
CREATE POLICY pie_runtime_gate_service_all ON public.pie_runtime_gate
 FOR ALL TO service_role USING(true) WITH CHECK(true);

COMMENT ON TABLE public.pie_runtime_decision IS
 'PIE runtime decision provenance. This is an internal audit stream, not a candidate-facing readiness source.';
COMMENT ON TABLE public.pie_runtime_gate IS
 'Explicit runtime certification gates. No automatic promotion is implemented.';
