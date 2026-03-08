
-- Table: clinical_stations
CREATE TABLE public.clinical_stations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  subject text NOT NULL,
  scenario_title text NOT NULL DEFAULT '',
  scenario_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.clinical_stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own stations" ON public.clinical_stations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own stations" ON public.clinical_stations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stations" ON public.clinical_stations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Table: station_attempts
CREATE TABLE public.station_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  station_index integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  mode text NOT NULL DEFAULT 'instant',
  chat_transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist_responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  psychograph jsonb NOT NULL DEFAULT '{}'::jsonb,
  behavioral_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_taken_seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.station_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own attempts" ON public.station_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own attempts" ON public.station_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own attempts" ON public.station_attempts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Table: psychograph_history
CREATE TABLE public.psychograph_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  cognitive_stability numeric NOT NULL DEFAULT 50,
  emotional_reactivity numeric NOT NULL DEFAULT 50,
  time_compression_vulnerability numeric NOT NULL DEFAULT 50,
  silence_tolerance numeric NOT NULL DEFAULT 50,
  delegation_confidence numeric NOT NULL DEFAULT 50,
  structure_integrity numeric NOT NULL DEFAULT 50,
  archetype text NOT NULL DEFAULT 'unclassified',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.psychograph_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own psychograph" ON public.psychograph_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own psychograph" ON public.psychograph_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
