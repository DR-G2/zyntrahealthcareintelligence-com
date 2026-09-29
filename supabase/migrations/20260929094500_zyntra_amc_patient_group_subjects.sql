-- AMC MCQ Spec V8 patient groups, used as the category for the Zyntra question bank.
INSERT INTO public.subjects (name, display_order) VALUES
  ('Adult Medicine', 100),
  ('Adult Surgery', 101),
  ('Women''s Health', 102),
  ('Child Health', 103),
  ('Mental Health', 104),
  ('Population Health & Ethics', 105)
ON CONFLICT (name) DO NOTHING;
