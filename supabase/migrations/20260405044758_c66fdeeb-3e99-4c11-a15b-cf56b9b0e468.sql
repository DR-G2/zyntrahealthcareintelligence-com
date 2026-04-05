
-- Visitor sessions table
CREATE TABLE public.visitor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  pages_visited integer DEFAULT 0,
  exit_page text,
  device_type text,
  browser text,
  country text,
  city text,
  ip_hash text,
  is_returning boolean DEFAULT false,
  visit_number integer DEFAULT 1,
  referrer text,
  platform text DEFAULT 'zyntra'
);

ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert visitor sessions" ON public.visitor_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon can update visitor sessions" ON public.visitor_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Page views table
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_id uuid,
  session_id uuid REFERENCES public.visitor_sessions(id) ON DELETE CASCADE,
  page text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  time_on_page_seconds integer DEFAULT 0,
  scroll_depth integer DEFAULT 0,
  platform text DEFAULT 'zyntra'
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert page views" ON public.page_views FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Intent signals table
CREATE TABLE public.intent_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_id uuid,
  session_id uuid REFERENCES public.visitor_sessions(id) ON DELETE CASCADE,
  action text NOT NULL,
  intent_level text NOT NULL DEFAULT 'low',
  page text,
  metadata jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz NOT NULL DEFAULT now(),
  platform text DEFAULT 'zyntra'
);

ALTER TABLE public.intent_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert intent signals" ON public.intent_signals FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Nudge signals table (poke feature)
CREATE TABLE public.nudge_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  user_id uuid,
  page text NOT NULL,
  message text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  platform text DEFAULT 'zyntra'
);

ALTER TABLE public.nudge_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert nudge signals" ON public.nudge_signals FOR INSERT TO anon, authenticated WITH CHECK (true);
