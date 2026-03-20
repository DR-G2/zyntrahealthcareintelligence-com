
CREATE TABLE public.subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subtopics" ON public.subtopics FOR SELECT TO authenticated USING (true);
