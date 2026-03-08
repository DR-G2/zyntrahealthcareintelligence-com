
-- Station bookmarks table
CREATE TABLE public.station_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  station_attempt_id uuid NOT NULL REFERENCES public.station_attempts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, station_attempt_id)
);
ALTER TABLE public.station_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own station bookmarks" ON public.station_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own station bookmarks" ON public.station_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own station bookmarks" ON public.station_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Station notes table
CREATE TABLE public.station_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  station_attempt_id uuid NOT NULL REFERENCES public.station_attempts(id) ON DELETE CASCADE,
  note_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, station_attempt_id)
);
ALTER TABLE public.station_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own station notes" ON public.station_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own station notes" ON public.station_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own station notes" ON public.station_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own station notes" ON public.station_notes FOR DELETE USING (auth.uid() = user_id);
