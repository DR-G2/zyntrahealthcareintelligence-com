
-- Piracy strikes table
CREATE TABLE public.piracy_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.piracy_strikes ENABLE ROW LEVEL SECURITY;

-- Watermark settings table
CREATE TABLE public.watermark_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  opacity_light numeric NOT NULL DEFAULT 0.055,
  opacity_dark numeric NOT NULL DEFAULT 0.065,
  suspended boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.watermark_settings ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read own watermark settings
CREATE POLICY "Users can read own watermark settings"
ON public.watermark_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS: Users can read own strikes
CREATE POLICY "Users can read own strikes"
ON public.piracy_strikes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Trigger function: on new strike, update watermark_settings
CREATE OR REPLACE FUNCTION public.handle_piracy_strike()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  strike_count integer;
  new_opacity_light numeric;
  new_opacity_dark numeric;
  is_suspended boolean;
BEGIN
  -- Count total strikes for user
  SELECT COUNT(*) INTO strike_count
  FROM public.piracy_strikes
  WHERE user_id = NEW.user_id;

  -- Calculate new opacity (base + 0.03 per strike)
  new_opacity_light := 0.055 + (strike_count * 0.03);
  new_opacity_dark := 0.065 + (strike_count * 0.03);
  is_suspended := strike_count >= 3;

  -- Upsert watermark settings
  INSERT INTO public.watermark_settings (user_id, opacity_light, opacity_dark, suspended, updated_at)
  VALUES (NEW.user_id, new_opacity_light, new_opacity_dark, is_suspended, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    opacity_light = EXCLUDED.opacity_light,
    opacity_dark = EXCLUDED.opacity_dark,
    suspended = EXCLUDED.suspended,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER on_piracy_strike_insert
AFTER INSERT ON public.piracy_strikes
FOR EACH ROW
EXECUTE FUNCTION public.handle_piracy_strike();
