-- Zyntra protected intelligence data hardening.
-- System-owned benchmark/model/training datasets must not be directly readable
-- by ordinary authenticated users. Admins retain controlled read access where needed.
-- User-facing model answers continue through the generate-model-answer Edge Function,
-- which uses the service role for its private cache.

-- 1) Ideal-candidate benchmark: system/admin only.
ALTER TABLE public.ideal_candidate_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read ideal profile" ON public.ideal_candidate_profile;
DROP POLICY IF EXISTS "Admins can read ideal candidate profile" ON public.ideal_candidate_profile;

REVOKE ALL ON TABLE public.ideal_candidate_profile FROM anon, authenticated;
GRANT SELECT ON TABLE public.ideal_candidate_profile TO authenticated;

CREATE POLICY "Admins can read ideal candidate profile"
  ON public.ideal_candidate_profile
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.jwt() ->> 'email'));

-- Prevent benchmark target discovery through the public helper.
REVOKE ALL ON FUNCTION public.compute_distance_from_ideal(numeric, numeric, numeric, numeric)
  FROM PUBLIC, anon, authenticated;

-- 2) AI training context: system/admin only.
ALTER TABLE public.ai_training_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read training context" ON public.ai_training_context;
DROP POLICY IF EXISTS "Admins can read AI training context" ON public.ai_training_context;

REVOKE ALL ON TABLE public.ai_training_context FROM anon, authenticated;
GRANT SELECT ON TABLE public.ai_training_context TO authenticated;

CREATE POLICY "Admins can read AI training context"
  ON public.ai_training_context
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.jwt() ->> 'email'));

-- 3) Model answers: no direct Data API access for ordinary users.
-- The generate-model-answer Edge Function uses service_role to read/write the cache
-- and returns only the requested walkthrough to the requesting user.
ALTER TABLE public.model_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read model answers" ON public.model_answers;
DROP POLICY IF EXISTS "Authenticated can insert model answers" ON public.model_answers;
DROP POLICY IF EXISTS "Admins can read model answers" ON public.model_answers;

REVOKE ALL ON TABLE public.model_answers FROM anon, authenticated;

-- Admins may inspect the cache when required.
GRANT SELECT ON TABLE public.model_answers TO authenticated;

CREATE POLICY "Admins can read model answers"
  ON public.model_answers
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.jwt() ->> 'email'));

-- No client role may write the global model-answer cache.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.model_answers
  FROM anon, authenticated;

-- 4) Internal intelligence rebuild functions accept arbitrary user IDs and are not
-- browser APIs. They are invoked by trusted database triggers/server-side code.
REVOKE ALL ON FUNCTION public.rebuild_candidate_intelligence(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.update_attempt_dna_on_attempt(uuid, uuid, boolean, numeric, integer, numeric, integer)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_performance_profile_from_attempts(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.update_intelligence_on_attempt()
  FROM PUBLIC, anon, authenticated;

-- Refresh PostgREST after the privilege/RLS changes.
NOTIFY pgrst, 'reload schema';
