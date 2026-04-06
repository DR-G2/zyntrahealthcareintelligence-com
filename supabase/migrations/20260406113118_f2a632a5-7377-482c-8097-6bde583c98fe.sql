
-- Add country and city columns
ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.visitor_sessions ADD COLUMN IF NOT EXISTS city text;

-- Add SELECT policy for visitor_sessions
CREATE POLICY "Anyone can select visitor sessions"
  ON public.visitor_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Add SELECT policies for admin dashboard
CREATE POLICY "Authenticated can select page views"
  ON public.page_views FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can select intent signals"
  ON public.intent_signals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can select nudge signals"
  ON public.nudge_signals FOR SELECT
  TO authenticated
  USING (true);
