
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referred_email TEXT,
  referred_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert own referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can update own referrals" ON public.referrals
  FOR UPDATE TO authenticated
  USING (auth.uid() = referrer_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_trial_end TIMESTAMP WITH TIME ZONE;
