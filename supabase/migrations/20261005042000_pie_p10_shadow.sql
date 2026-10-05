-- P10 shadow deployment controls.
CREATE TABLE IF NOT EXISTS public.pie_shadow_run (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL,
 mode TEXT NOT NULL DEFAULT 'SHADOW' CHECK (mode='SHADOW'),
 model_version TEXT NOT NULL,
 exam_adapter_version TEXT,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ended_at TIMESTAMPTZ,
 observation_count INTEGER NOT NULL DEFAULT 0 CHECK (observation_count>=0),
 decision_count INTEGER NOT NULL DEFAULT 0 CHECK (decision_count>=0),
 candidate_facing BOOLEAN NOT NULL DEFAULT false,
 legacy_authoritative BOOLEAN NOT NULL DEFAULT true,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','BLOCKED','FAILED')),
 error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count>=0)
);
CREATE INDEX IF NOT EXISTS pie_shadow_run_user_time_idx ON public.pie_shadow_run(user_id,started_at DESC);
ALTER TABLE public.pie_shadow_run ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pie_shadow_run_owner_select ON public.pie_shadow_run;
CREATE POLICY pie_shadow_run_owner_select ON public.pie_shadow_run
 FOR SELECT TO authenticated USING(user_id=auth.uid());
DROP POLICY IF EXISTS pie_shadow_run_service_all ON public.pie_shadow_run;
CREATE POLICY pie_shadow_run_service_all ON public.pie_shadow_run
 FOR ALL TO service_role USING(true) WITH CHECK(true);

COMMENT ON TABLE public.pie_shadow_run IS
 'P10 PIE shadow execution. Legacy readiness remains authoritative and PIE is never candidate-facing.';
