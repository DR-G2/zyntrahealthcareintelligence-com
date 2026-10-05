-- PIE runtime shadow bridge v1.
-- Legacy intelligence remains authoritative.

ALTER TABLE public.pie_observation
  ADD COLUMN IF NOT EXISTS source_attempt_id UUID
    REFERENCES public.user_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS difficulty NUMERIC
    CHECK (difficulty IS NULL OR (difficulty >= 0 AND difficulty <= 1));

CREATE UNIQUE INDEX IF NOT EXISTS pie_observation_source_attempt_uidx
  ON public.pie_observation(source_attempt_id)
  WHERE source_attempt_id IS NOT NULL;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.pie_observation
  FROM authenticated, anon;

DROP POLICY IF EXISTS pie_observation_owner_select ON public.pie_observation;
DROP POLICY IF EXISTS pie_observation_service_select ON public.pie_observation;
DROP POLICY IF EXISTS pie_observation_service_insert ON public.pie_observation;
DROP POLICY IF EXISTS pie_observation_service_update ON public.pie_observation;
DROP POLICY IF EXISTS pie_observation_service_delete ON public.pie_observation;

CREATE POLICY pie_observation_service_select
  ON public.pie_observation FOR SELECT TO service_role USING (true);

CREATE POLICY pie_observation_service_insert
  ON public.pie_observation FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY pie_observation_service_update
  ON public.pie_observation FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY pie_observation_service_delete
  ON public.pie_observation FOR DELETE TO service_role USING (true);

COMMENT ON COLUMN public.pie_observation.source_attempt_id IS
  'Stable source linkage for idempotent shadow normalization from user_attempts. Internal only.';

COMMENT ON COLUMN public.pie_observation.difficulty IS
  'Question difficulty metadata at attempt time when available. NULL means unknown.';
