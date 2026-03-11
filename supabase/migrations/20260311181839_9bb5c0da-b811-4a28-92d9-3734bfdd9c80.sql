
-- Part 2: Add zyntra_id columns
ALTER TABLE public.questions ADD COLUMN zyntra_id text UNIQUE;
ALTER TABLE public.clinical_stations ADD COLUMN zyntra_id text UNIQUE;

-- Part 4: Add subtopic, system, guideline_reference to questions
ALTER TABLE public.questions ADD COLUMN subtopic text;
ALTER TABLE public.questions ADD COLUMN system_category text;
ALTER TABLE public.questions ADD COLUMN guideline_reference text;

-- Part 6: OSCE station schema enhancement
ALTER TABLE public.clinical_stations ADD COLUMN candidate_instructions text;
ALTER TABLE public.clinical_stations ADD COLUMN examiner_instructions text;
ALTER TABLE public.clinical_stations ADD COLUMN marking_checklist jsonb DEFAULT '[]';
ALTER TABLE public.clinical_stations ADD COLUMN reading_time_minutes integer DEFAULT 2;
ALTER TABLE public.clinical_stations ADD COLUMN station_time_minutes integer DEFAULT 8;

-- Auto-assign zyntra_id trigger for questions
CREATE OR REPLACE FUNCTION public.assign_zyntra_id_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_num integer;
BEGIN
  IF NEW.zyntra_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(zyntra_id FROM 'MCQ-(\d+)$') AS integer)), 0)
    INTO max_num FROM public.questions WHERE zyntra_id IS NOT NULL;
    NEW.zyntra_id := 'ZYNTRA-MCQ-' || LPAD((max_num + 1)::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_zyntra_id_question
BEFORE INSERT ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.assign_zyntra_id_question();

-- Auto-assign zyntra_id trigger for clinical_stations
CREATE OR REPLACE FUNCTION public.assign_zyntra_id_station()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_num integer;
BEGIN
  IF NEW.zyntra_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(zyntra_id FROM 'OSCE-(\d+)$') AS integer)), 0)
    INTO max_num FROM public.clinical_stations WHERE zyntra_id IS NOT NULL;
    NEW.zyntra_id := 'ZYNTRA-OSCE-' || LPAD((max_num + 1)::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_zyntra_id_station
BEFORE INSERT ON public.clinical_stations
FOR EACH ROW EXECUTE FUNCTION public.assign_zyntra_id_station();
