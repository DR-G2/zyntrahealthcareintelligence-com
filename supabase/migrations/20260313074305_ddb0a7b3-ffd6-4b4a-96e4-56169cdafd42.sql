
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exam_target text,
  ADD COLUMN IF NOT EXISTS amc1_score integer,
  ADD COLUMN IF NOT EXISTS amc2_booking_status text,
  ADD COLUMN IF NOT EXISTS exam_location text;
