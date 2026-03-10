ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_of_origin text,
  ADD COLUMN IF NOT EXISTS country_of_graduation text,
  ADD COLUMN IF NOT EXISTS medical_college text,
  ADD COLUMN IF NOT EXISTS graduation_year integer,
  ADD COLUMN IF NOT EXISTS current_location text,
  ADD COLUMN IF NOT EXISTS exam_stage text;