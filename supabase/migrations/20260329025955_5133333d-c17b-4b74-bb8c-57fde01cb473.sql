
CREATE TABLE public.data_export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL DEFAULT 'export',
  file_name text,
  merge_mode text,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'completed',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.data_export_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own export history"
  ON public.data_export_history FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_data_export_history_user ON public.data_export_history(user_id, created_at DESC);
