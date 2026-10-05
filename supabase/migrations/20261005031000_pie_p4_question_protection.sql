-- PIE P4: question intelligence protection and quarantine.
-- Question statistical internals remain service-role controlled.

CREATE TABLE IF NOT EXISTS public.pie_question_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL,
  question_version TEXT NOT NULL,
  reason_code TEXT NOT NULL
    CHECK (reason_code IN (
      'HIGH_AMBIGUITY',
      'LOW_EVIDENCE',
      'LOW_DISCRIMINATION',
      'CONTRADICTORY_EVIDENCE',
      'PRODUCTION_DEFECT',
      'VERSION_CONFLICT',
      'OTHER'
    )),
  severity TEXT NOT NULL DEFAULT 'REVIEW'
    CHECK (severity IN ('REVIEW','HOLD','RETIRED')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS pie_question_quarantine_question_idx
  ON public.pie_question_quarantine (question_id, question_version, created_at DESC);

CREATE INDEX IF NOT EXISTS pie_question_quarantine_open_idx
  ON public.pie_question_quarantine (severity, resolved_at);

ALTER TABLE public.pie_question_quarantine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_question_quarantine_service_select ON public.pie_question_quarantine;
CREATE POLICY pie_question_quarantine_service_select
  ON public.pie_question_quarantine
  FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS pie_question_quarantine_service_insert ON public.pie_question_quarantine;
CREATE POLICY pie_question_quarantine_service_insert
  ON public.pie_question_quarantine
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS pie_question_quarantine_service_update ON public.pie_question_quarantine;
CREATE POLICY pie_question_quarantine_service_update
  ON public.pie_question_quarantine
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pie_question_quarantine_service_delete ON public.pie_question_quarantine;
CREATE POLICY pie_question_quarantine_service_delete
  ON public.pie_question_quarantine
  FOR DELETE TO service_role USING (true);

COMMENT ON TABLE public.pie_question_quarantine IS
  'Safety boundary for uncertain or defective question versions. Candidate confidence is not reduced merely because a question is uncertain.';
COMMENT ON COLUMN public.pie_question_quarantine.evidence IS
  'Structured evidence and provenance supporting quarantine. No single candidate response is sufficient validation.';
