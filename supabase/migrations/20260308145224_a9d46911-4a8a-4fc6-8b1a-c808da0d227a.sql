
-- Study Groups
CREATE TABLE public.study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

-- Study Group Members
CREATE TABLE public.study_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

-- Shared Tests
CREATE TABLE public.shared_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  test_type text NOT NULL DEFAULT 'mcq',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_tests ENABLE ROW LEVEL SECURITY;

-- Shared Test Participants
CREATE TABLE public.shared_test_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_test_id uuid NOT NULL REFERENCES public.shared_tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score jsonb DEFAULT NULL,
  completed_at timestamptz DEFAULT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shared_test_id, user_id)
);
ALTER TABLE public.shared_test_participants ENABLE ROW LEVEL SECURITY;

-- Helper function to check group membership
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

-- Helper function to check shared test participation
CREATE OR REPLACE FUNCTION public.is_test_participant(_user_id uuid, _test_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_test_participants
    WHERE user_id = _user_id AND shared_test_id = _test_id
  )
$$;

-- RLS: study_groups
CREATE POLICY "Members can view their groups" ON public.study_groups
  FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), id) OR created_by = auth.uid());

CREATE POLICY "Auth users can create groups" ON public.study_groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner can update group" ON public.study_groups
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Owner can delete group" ON public.study_groups
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- RLS: study_group_members
CREATE POLICY "Members can view group members" ON public.study_group_members
  FOR SELECT TO authenticated
  USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Owner can add members" ON public.study_group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.study_groups WHERE id = group_id AND created_by = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Owner can remove members" ON public.study_group_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.study_groups WHERE id = group_id AND created_by = auth.uid())
    OR user_id = auth.uid()
  );

-- RLS: shared_tests
CREATE POLICY "Participants can view shared tests" ON public.shared_tests
  FOR SELECT TO authenticated
  USING (public.is_test_participant(auth.uid(), id) OR created_by = auth.uid());

CREATE POLICY "Auth users can create shared tests" ON public.shared_tests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update shared test" ON public.shared_tests
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete shared test" ON public.shared_tests
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- RLS: shared_test_participants
CREATE POLICY "Participants can view test participants" ON public.shared_test_participants
  FOR SELECT TO authenticated
  USING (public.is_test_participant(auth.uid(), shared_test_id) OR user_id = auth.uid());

CREATE POLICY "Users can join shared tests" ON public.shared_test_participants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation" ON public.shared_test_participants
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Allow looking up profiles by email for group invites
CREATE POLICY "Authenticated users can lookup profiles by email" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);
