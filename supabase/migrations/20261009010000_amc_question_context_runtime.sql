-- Reconcile the live AMC runtime schema with the P0-P6 contract.
-- This is intentionally metadata-only: no question is tagged as AMC-ready without reviewed mapping evidence.

CREATE TABLE IF NOT EXISTS public.amc_question_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  question_version TEXT NOT NULL,
  exam_mode TEXT NOT NULL CHECK (exam_mode IN ('MCQ','CLINICAL')),
  patient_group TEXT,
  clinical_domain TEXT,
  task_type TEXT,
  cognitive_demand TEXT,
  question_family TEXT,
  novelty_class TEXT,
  amc_relevance TEXT,
  source_evidence_level TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plugin_version_id, question_id, question_version)
);


DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'amc_question_context_question_id_fkey'
      AND conrelid = 'public.amc_question_context'::regclass
  ) THEN
    ALTER TABLE public.amc_question_context
      ADD CONSTRAINT amc_question_context_question_id_fkey
      FOREIGN KEY (question_id) REFERENCES public.questions(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END;
$;

ALTER TABLE public.amc_question_context
  ALTER COLUMN question_id DROP NOT NULL,
  ALTER COLUMN question_version DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES public.clinical_stations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS station_version TEXT;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'amc_question_context_one_content_target'
      AND conrelid = 'public.amc_question_context'::regclass
  ) THEN
    ALTER TABLE public.amc_question_context
      ADD CONSTRAINT amc_question_context_one_content_target CHECK (
        (question_id IS NOT NULL AND question_version IS NOT NULL AND station_id IS NULL AND station_version IS NULL)
        OR
        (station_id IS NOT NULL AND station_version IS NOT NULL AND question_id IS NULL AND question_version IS NULL)
      ) NOT VALID;
  END IF;
END;
$;

CREATE UNIQUE INDEX IF NOT EXISTS amc_question_context_station_version_uq
  ON public.amc_question_context(plugin_version_id, station_id, station_version)
  WHERE station_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS amc_question_context_lookup_idx
  ON public.amc_question_context(plugin_version_id, exam_mode, patient_group);

ALTER TABLE public.amc_question_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amc_question_context FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.amc_question_context TO service_role;

DROP POLICY IF EXISTS amc_question_context_service_all ON public.amc_question_context;
CREATE POLICY amc_question_context_service_all
  ON public.amc_question_context
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.amc_question_context IS
'Versioned AMC question metadata. Empty until question-level mappings are independently reviewed; absence must never trigger generic-question fallback.';
