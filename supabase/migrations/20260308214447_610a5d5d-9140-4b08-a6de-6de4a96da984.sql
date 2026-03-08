
-- Allow authenticated users to look up open tests (needed for joining by code)
CREATE POLICY "Auth users can lookup open tests by code"
ON public.shared_tests
FOR SELECT
TO authenticated
USING (status = 'open');

-- Allow creator to delete participants when deleting a test
CREATE POLICY "Creator can delete test participants"
ON public.shared_test_participants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shared_tests
    WHERE shared_tests.id = shared_test_participants.shared_test_id
    AND shared_tests.created_by = auth.uid()
  )
  OR auth.uid() = user_id
);
