-- Security hardening: candidates must never read other candidates' profiles.
-- A legacy group-invite policy used USING (true), exposing all profile fields
-- including exam dates and candidate performance metadata to any authenticated user.
DROP POLICY IF EXISTS "Authenticated users can lookup profiles by email" ON public.profiles;

-- Keep the original owner-only policy as the sole candidate SELECT policy:
-- "Users can view own profile" USING (auth.uid() = id).
