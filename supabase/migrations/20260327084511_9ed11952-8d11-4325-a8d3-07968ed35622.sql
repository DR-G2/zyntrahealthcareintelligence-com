
-- Training notifications table
CREATE TABLE public.training_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'insight',
  category TEXT NOT NULL DEFAULT 'performance',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cta_label TEXT,
  cta_route TEXT,
  icon TEXT DEFAULT 'zap',
  priority INTEGER NOT NULL DEFAULT 5,
  read_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast user queries
CREATE INDEX idx_training_notifications_user ON public.training_notifications(user_id, created_at DESC);
CREATE INDEX idx_training_notifications_unread ON public.training_notifications(user_id) WHERE read_at IS NULL;

-- RLS
ALTER TABLE public.training_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.training_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.training_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.training_notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
