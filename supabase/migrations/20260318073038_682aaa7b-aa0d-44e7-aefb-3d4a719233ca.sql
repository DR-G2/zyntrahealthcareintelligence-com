
-- Add question_type to questions table (default 'mcq' for existing rows)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'mcq';

-- Update zyntra_id trigger to use QN- prefix for universal IDs
CREATE OR REPLACE FUNCTION public.assign_zyntra_id_question()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE max_num integer;
BEGIN
  IF NEW.zyntra_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(zyntra_id FROM '(\d+)$') AS integer)), 0)
    INTO max_num FROM public.questions WHERE zyntra_id IS NOT NULL;
    NEW.zyntra_id := 'QN-' || LPAD((max_num + 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS set_zyntra_id_question ON public.questions;
CREATE TRIGGER set_zyntra_id_question BEFORE INSERT ON public.questions FOR EACH ROW EXECUTE FUNCTION public.assign_zyntra_id_question();
