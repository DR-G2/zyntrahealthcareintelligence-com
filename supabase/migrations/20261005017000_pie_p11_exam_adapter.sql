-- PIE v1.0 P1.1: exam adapter
-- Purpose: represent an exam environment separately from the candidate's core state.
-- The adapter changes the decision context, not the underlying candidate state.
-- No readiness score or fixed exam weights are calculated here.

CREATE TABLE IF NOT EXISTS public.pie_exam_environment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  exam_code TEXT NOT NULL,
  exam_version TEXT NOT NULL,

  blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
  timing JSONB NOT NULL DEFAULT '{}'::jsonb,
  difficulty_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  task_mix JSONB NOT NULL DEFAULT '{}'::jsonb,

  target_definition JSONB NOT NULL DEFAULT '{}'::jsonb,

  duration_seconds INTEGER
    CHECK (duration_seconds IS NULL OR duration_seconds > 0),

  model_version TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (
      status IN (
        'DRAFT',
        'VALIDATING',
        'ACTIVE',
        'RETIRED'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_exam_environment_version_unique
    UNIQUE (exam_code, exam_version)
);

COMMENT ON TABLE public.pie_exam_environment IS
  'Versioned exam environment used to transform core candidate state into exam-specific predictions.';

COMMENT ON COLUMN public.pie_exam_environment.blueprint IS
  'Exam content blueprint. It must remain separate from the candidate state.';

COMMENT ON COLUMN public.pie_exam_environment.timing IS
  'Exam timing structure and constraints.';

COMMENT ON COLUMN public.pie_exam_environment.difficulty_distribution IS
  'Expected difficulty distribution for the exam version.';

COMMENT ON COLUMN public.pie_exam_environment.task_mix IS
  'Expected task/station/question mix for the exam version.';

COMMENT ON COLUMN public.pie_exam_environment.target_definition IS
  'Definition of the exam outcome or target event being predicted.';

CREATE INDEX IF NOT EXISTS pie_exam_environment_code_idx
  ON public.pie_exam_environment (exam_code, status);

CREATE INDEX IF NOT EXISTS pie_exam_environment_model_idx
  ON public.pie_exam_environment (model_version);

ALTER TABLE public.pie_exam_environment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_exam_environment_service_select ON public.pie_exam_environment;
CREATE POLICY pie_exam_environment_service_select
  ON public.pie_exam_environment
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_exam_environment_service_insert ON public.pie_exam_environment;
CREATE POLICY pie_exam_environment_service_insert
  ON public.pie_exam_environment
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_exam_environment_service_update ON public.pie_exam_environment;
CREATE POLICY pie_exam_environment_service_update
  ON public.pie_exam_environment
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_exam_environment_service_delete ON public.pie_exam_environment;
CREATE POLICY pie_exam_environment_service_delete
  ON public.pie_exam_environment
  FOR DELETE
  TO service_role
  USING (true);

CREATE TABLE IF NOT EXISTS public.pie_exam_adapter_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  candidate_state_id UUID
    REFERENCES public.pie_candidate_state(id) ON DELETE SET NULL,

  exam_environment_id UUID NOT NULL
    REFERENCES public.pie_exam_environment(id) ON DELETE RESTRICT,

  state_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),

  core_state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  adaptation_context JSONB NOT NULL DEFAULT '{}'::jsonb,

  model_version TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_exam_adapter_snapshot IS
  'Immutable-style record of the candidate core state and exam context used for an exam-specific inference.';

COMMENT ON COLUMN public.pie_exam_adapter_snapshot.core_state_snapshot IS
  'Snapshot of the candidate state. The exam adapter must not rewrite the underlying candidate state.';

COMMENT ON COLUMN public.pie_exam_adapter_snapshot.adaptation_context IS
  'Exam-specific context applied to the core state for downstream readiness inference.';

CREATE INDEX IF NOT EXISTS pie_exam_adapter_snapshot_user_time_idx
  ON public.pie_exam_adapter_snapshot (user_id, state_timestamp DESC);

CREATE INDEX IF NOT EXISTS pie_exam_adapter_snapshot_exam_idx
  ON public.pie_exam_adapter_snapshot (exam_environment_id);

ALTER TABLE public.pie_exam_adapter_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_exam_adapter_snapshot_owner_select ON public.pie_exam_adapter_snapshot;
CREATE POLICY pie_exam_adapter_snapshot_owner_select
  ON public.pie_exam_adapter_snapshot
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_exam_adapter_snapshot_service_select ON public.pie_exam_adapter_snapshot;
CREATE POLICY pie_exam_adapter_snapshot_service_select
  ON public.pie_exam_adapter_snapshot
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_exam_adapter_snapshot_service_insert ON public.pie_exam_adapter_snapshot;
CREATE POLICY pie_exam_adapter_snapshot_service_insert
  ON public.pie_exam_adapter_snapshot
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_exam_adapter_snapshot_service_update ON public.pie_exam_adapter_snapshot;
CREATE POLICY pie_exam_adapter_snapshot_service_update
  ON public.pie_exam_adapter_snapshot
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_exam_adapter_snapshot_service_delete ON public.pie_exam_adapter_snapshot;
CREATE POLICY pie_exam_adapter_snapshot_service_delete
  ON public.pie_exam_adapter_snapshot
  FOR DELETE
  TO service_role
  USING (true);

-- P1.1 deliberately does not create a readiness score.
-- The next phase will consume this environment plus the candidate state.
-- The core candidate model remains exam-neutral.
