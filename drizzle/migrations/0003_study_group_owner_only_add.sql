DROP POLICY IF EXISTS "Owner can add members" ON public.study_group_members;
CREATE POLICY "Owner can add members" ON public.study_group_members
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = study_group_members.group_id AND g.created_by = auth.uid()));