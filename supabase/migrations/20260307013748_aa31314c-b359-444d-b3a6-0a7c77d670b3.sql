
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS diagnosis_explanation text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS first_line_investigation text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS gold_standard_investigation text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS best_treatment text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS differential_diagnoses jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS incorrect_answer_explanations jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS key_takeaways text[];
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS clinical_vignette boolean DEFAULT true;
