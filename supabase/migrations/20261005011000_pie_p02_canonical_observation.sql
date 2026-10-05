-- PIE v1.0 P0.2: canonical observation layer
-- Purpose: normalize raw attempt/event evidence into an auditable PIE observation.
-- This migration stores observations only. It does not infer candidate state or readiness.

CREATE TABLE IF NOT EXISTS public.pie_observation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL,
  session_id UUID,
  question_id UUID,
  question_version TEXT,

  occurred_at TIMESTAMPTZ NOT NULL,
  question_position INTEGER,

  outcome TEXT NOT NULL
    CHECK (outcome IN (
      'CORRECT',
      'INCORRECT',
      'UNANSWERED',
      'INVALID',
      'UNKNOWN'
    )),

  confidence_raw NUMERIC,
  confidence_normalized NUMERIC
    CHECK (
      confidence_normalized IS NULL
      OR (confidence_normalized >= 0 AND confidence_normalized <= 1)
    ),

  time_total_ms BIGINT,
  time_to_first_interaction_ms BIGINT,
  time_to_answer_ms BIGINT,
  time_post_decision_ms BIGINT,

  first_answer TEXT,
  final_answer TEXT,

  first_answer_correct BOOLEAN,
  final_answer_correct BOOLEAN,

  answer_changes INTEGER NOT NULL DEFAULT 0
    CHECK (answer_changes >= 0),

  change_direction TEXT,

  interaction_state TEXT,
  environment_state TEXT,

  observation_quality TEXT NOT NULL DEFAULT 'VALID'
    CHECK (observation_quality IN (
      'VALID',
      'SUSPICIOUS',
      'CONTRADICTORY',
      'UNUSABLE'
    )),

  observation_version INTEGER NOT NULL DEFAULT 1
    CHECK (observation_version > 0),

  source_event_ids UUID[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pie_observation IS
  'Canonical PIE observation layer. Represents observed evidence only. NULL means evidence was not captured and must not be interpreted as zero.';

COMMENT ON COLUMN public.pie_observation.confidence_normalized IS
  'Normalized candidate-reported confidence in [0,1]. Missing confidence remains NULL.';

COMMENT ON COLUMN public.pie_observation.time_total_ms IS
  'Observed total task duration. Component timings must not be fabricated when event evidence is absent.';

COMMENT ON COLUMN public.pie_observation.time_to_first_interaction_ms IS
  'Observed time from question exposure/open to first interaction, when measurable.';

COMMENT ON COLUMN public.pie_observation.time_to_answer_ms IS
  'Observed time to answer selection, when measurable.';

COMMENT ON COLUMN public.pie_observation.time_post_decision_ms IS
  'Observed time between answer decision and submission, when measurable.';

COMMENT ON COLUMN public.pie_observation.observation_quality IS
  'Evidence quality classification. SUSPICIOUS or CONTRADICTORY observations must not be treated as clean evidence.';

COMMENT ON COLUMN public.pie_observation.source_event_ids IS
  'Immutable behavior-event identifiers used to construct this observation.';

ALTER TABLE public.pie_observation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_observation_owner_select ON public.pie_observation;
CREATE POLICY pie_observation_owner_select
  ON public.pie_observation
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pie_observation_service_select ON public.pie_observation;
CREATE POLICY pie_observation_service_select
  ON public.pie_observation
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_observation_service_insert ON public.pie_observation;
CREATE POLICY pie_observation_service_insert
  ON public.pie_observation
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_observation_service_update ON public.pie_observation;
CREATE POLICY pie_observation_service_update
  ON public.pie_observation
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_observation_service_delete ON public.pie_observation;
CREATE POLICY pie_observation_service_delete
  ON public.pie_observation
  FOR DELETE
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS pie_observation_user_time_idx
  ON public.pie_observation (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS pie_observation_session_position_idx
  ON public.pie_observation (session_id, question_position);

CREATE INDEX IF NOT EXISTS pie_observation_question_version_idx
  ON public.pie_observation (question_id, question_version);

CREATE INDEX IF NOT EXISTS pie_observation_quality_idx
  ON public.pie_observation (observation_quality);

-- P0.2 deliberately does not backfill historical observations.
-- Backfill requires a separately validated normalization procedure so that
-- missing telemetry is not converted into false precision.
