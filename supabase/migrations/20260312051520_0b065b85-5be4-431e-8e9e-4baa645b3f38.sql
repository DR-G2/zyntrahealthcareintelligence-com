
-- Threads table
CREATE TABLE public.admin_message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  admin_email text NOT NULL,
  candidate_email text,
  subject text DEFAULT 'No subject',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(admin_id, candidate_id)
);

ALTER TABLE public.admin_message_threads ENABLE ROW LEVEL SECURITY;

-- Candidates can view their own threads
CREATE POLICY "Candidates can view own threads"
  ON public.admin_message_threads FOR SELECT TO authenticated
  USING (auth.uid() = candidate_id);

-- Messages table
CREATE TABLE public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.admin_message_threads(id) ON DELETE CASCADE,
  sender_role text NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- Candidates can read messages in their threads
CREATE POLICY "Candidates can read own thread messages"
  ON public.admin_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_message_threads
      WHERE id = admin_messages.thread_id AND candidate_id = auth.uid()
    )
  );

-- Candidates can reply (insert) into their own threads only
CREATE POLICY "Candidates can reply to own threads"
  ON public.admin_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'candidate'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.admin_message_threads
      WHERE id = thread_id AND candidate_id = auth.uid()
    )
  );

-- Candidates can mark messages as read
CREATE POLICY "Candidates can mark messages read"
  ON public.admin_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_message_threads
      WHERE id = admin_messages.thread_id AND candidate_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_message_threads
      WHERE id = admin_messages.thread_id AND candidate_id = auth.uid()
    )
  );

-- Enable realtime for instant messaging
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_messages;
