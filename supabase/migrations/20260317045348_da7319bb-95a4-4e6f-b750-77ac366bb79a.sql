
-- Create question-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('question-images', 'question-images', true, 2097152);

-- Storage policies for question-images
CREATE POLICY "Anyone can view question images"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-images');

CREATE POLICY "Authenticated users can upload question images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Authenticated users can delete question images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'question-images');

-- Create subjects table
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subjects"
ON public.subjects FOR SELECT
TO authenticated
USING (true);

-- Seed with existing categories
INSERT INTO public.subjects (name, display_order) VALUES
  ('Cardiology', 1),
  ('Respiratory', 2),
  ('Gastrointestinal', 3),
  ('Neurology', 4),
  ('Endocrinology', 5),
  ('Renal', 6),
  ('Dermatology', 7),
  ('Psychiatry', 8),
  ('Paediatrics', 9),
  ('Obstetrics & Gynaecology', 10),
  ('Emergency Medicine', 11),
  ('Infectious Diseases', 12),
  ('Population Health', 13),
  ('ENT', 14),
  ('Haematology', 15),
  ('Musculoskeletal', 16),
  ('Surgery', 17);
