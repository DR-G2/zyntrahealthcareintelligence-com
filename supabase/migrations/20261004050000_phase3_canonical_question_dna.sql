-- Zyntra Phase 3: canonical Question DNA
-- Separate static content metadata from observed candidate-performance telemetry.
-- Question DNA is server-derived and remains read-only from the browser.

ALTER TABLE public.question_dna
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS blueprint_domain text,
  ADD COLUMN IF NOT EXISTS cognitive_task text,
  ADD COLUMN IF NOT EXISTS clinical_reasoning_type text,
  ADD COLUMN IF NOT EXISTS knowledge_type text,
  ADD COLUMN IF NOT EXISTS australian_context text,
  ADD COLUMN IF NOT EXISTS has_image boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ecg boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_radiology boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ambiguity_risk numeric,
  ADD COLUMN IF NOT EXISTS distractor_type text,
  ADD COLUMN IF NOT EXISTS expected_discrimination numeric,
  ADD COLUMN IF NOT EXISTS explanation_quality numeric,
  ADD COLUMN IF NOT EXISTS reviewer_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS references jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duplicate_cluster text,
  ADD COLUMN IF NOT EXISTS production_status text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS source_question_version text,
  ADD COLUMN IF NOT EXISTS observed_confidence_error_rate numeric DEFAULT 0;

ALTER TABLE public.question_dna
  DROP CONSTRAINT IF EXISTS question_dna_reviewer_status_check,
  DROP CONSTRAINT IF EXISTS question_dna_production_status_check;
ALTER TABLE public.question_dna
  ADD CONSTRAINT question_dna_reviewer_status_check CHECK (reviewer_status IN ('unreviewed','in_review','approved','rejected')),
  ADD CONSTRAINT question_dna_production_status_check CHECK (production_status IN ('unclassified','draft','production','temp','archived'));

ALTER TABLE public.user_attempts
  ADD COLUMN IF NOT EXISTS question_difficulty_at_attempt text,
  ADD COLUMN IF NOT EXISTS question_dna_version_at_attempt integer;

-- Static metadata currently available on questions is copied into canonical DNA.
-- Fields requiring clinical/editorial review remain explicitly unreviewed rather than invented.
CREATE OR REPLACE FUNCTION public.sync_question_dna_from_question(p_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q public.questions%ROWTYPE;
BEGIN
  SELECT * INTO q FROM public.questions WHERE id = p_question_id;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.question_dna (
    question_id, subject, specialty, blueprint_domain, australian_context,
    production_status, version, updated_at
  )
  VALUES (
    q.id,
    q.category,
    q.subtopic,
    q.system_category,
    'unreviewed',
    'unclassified',
    1,
    now()
  )
  ON CONFLICT (question_id) DO UPDATE SET
    subject = EXCLUDED.subject,
    specialty = EXCLUDED.specialty,
    blueprint_domain = COALESCE(EXCLUDED.blueprint_domain, public.question_dna.blueprint_domain),
    australian_context = CASE
      WHEN public.question_dna.australian_context IN ('reviewed-australian', 'reviewed-non-australian')
        THEN public.question_dna.australian_context
      ELSE EXCLUDED.australian_context
    END,
    updated_at = now();
END;
$$;

-- Keep Question DNA aligned whenever source question metadata changes.
CREATE OR REPLACE FUNCTION public.trg_sync_question_dna()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_question_dna_from_question(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_question_dna ON public.questions;
CREATE TRIGGER trg_sync_question_dna
AFTER INSERT OR UPDATE OF category, subtopic, system_category, guideline_reference, question_type, difficulty, difficulty_tier, tags
ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_question_dna();

-- Snapshot the question's difficulty and DNA version into each new attempt.
CREATE OR REPLACE FUNCTION public.snapshot_question_dna_on_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_difficulty text;
  v_version integer;
BEGIN
  SELECT q.difficulty, COALESCE(d.version, 1)
  INTO v_difficulty, v_version
  FROM public.questions q
  LEFT JOIN public.question_dna d ON d.question_id = q.id
  WHERE q.id = NEW.question_id;

  NEW.question_difficulty_at_attempt := v_difficulty;
  NEW.question_dna_version_at_attempt := v_version;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_question_dna_on_attempt ON public.user_attempts;
CREATE TRIGGER trg_snapshot_question_dna_on_attempt
BEFORE INSERT ON public.user_attempts
FOR EACH ROW EXECUTE FUNCTION public.snapshot_question_dna_on_attempt();

-- Backfill canonical DNA metadata for the existing question bank.
INSERT INTO public.question_dna (question_id, subject, specialty, blueprint_domain, australian_context, production_status, version, updated_at)
SELECT q.id,
       q.category,
       q.subtopic,
       q.system_category,
       'unreviewed',
       'unclassified',
       1,
       now()
FROM public.questions q
ON CONFLICT (question_id) DO UPDATE SET
  subject = EXCLUDED.subject,
  specialty = EXCLUDED.specialty,
  blueprint_domain = EXCLUDED.blueprint_domain,
  australian_context = CASE
    WHEN public.question_dna.australian_context IN ('reviewed-australian', 'reviewed-non-australian')
      THEN public.question_dna.australian_context
    ELSE EXCLUDED.australian_context
  END,
  updated_at = now();

-- Phase 1 server ownership: reinforce browser immutability after adding fields.
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER
  ON public.question_dna FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_question_dna_from_question(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sync_question_dna() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_question_dna_on_attempt() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
