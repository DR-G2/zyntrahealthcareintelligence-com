-- PIE v1.0 P1.5: legacy compatibility / shadow bridge
-- Purpose: keep the existing intelligence tables and UI working while PIE
-- develops in parallel.
--
-- Legacy remains the current source of truth for existing UI consumers.
-- PIE outputs are never silently written into readiness_dna or behavior_dna
-- by this migration.

CREATE TABLE IF NOT EXISTS public.pie_legacy_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  compatibility_context TEXT NOT NULL DEFAULT 'PERFORMANCE_INTELLIGENCE',

  source_of_truth TEXT NOT NULL DEFAULT 'LEGACY'
    CHECK (
      source_of_truth IN (
        'LEGACY',
        'PIE_SHADOW',
        'PIE_PROMOTED'
      )
    ),

  compatibility_status TEXT NOT NULL DEFAULT 'SHADOW'
    CHECK (
      compatibility_status IN (
        'SHADOW',
        'READY_FOR_REVIEW',
        'PROMOTED',
        'RETIRED'
      )
    ),

  legacy_readiness_updated_at TIMESTAMPTZ,
  legacy_behavior_updated_at TIMESTAMPTZ,

  pie_candidate_state_id UUID
    REFERENCES public.pie_candidate_state(id) ON DELETE SET NULL,

  pie_readiness_id UUID
    REFERENCES public.pie_exam_readiness(id) ON DELETE SET NULL,

  model_version TEXT,

  promotion_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pie_legacy_compatibility_user_context_unique
    UNIQUE (user_id, compatibility_context)
);

COMMENT ON TABLE public.pie_legacy_compatibility IS
  'Shadow bridge between legacy intelligence and PIE. Legacy remains authoritative until PIE validation and explicit promotion.';

COMMENT ON COLUMN public.pie_legacy_compatibility.source_of_truth IS
  'LEGACY is the default production source. PIE_SHADOW records parallel PIE inference. PIE_PROMOTED requires an explicit governance decision.';

COMMENT ON COLUMN public.pie_legacy_compatibility.compatibility_status IS
  'Compatibility lifecycle. No automatic promotion is permitted.';

CREATE INDEX IF NOT EXISTS pie_legacy_compatibility_user_idx
  ON public.pie_legacy_compatibility (user_id);

CREATE INDEX IF NOT EXISTS pie_legacy_compatibility_pie_state_idx
  ON public.pie_legacy_compatibility (pie_candidate_state_id);

CREATE INDEX IF NOT EXISTS pie_legacy_compatibility_pie_readiness_idx
  ON public.pie_legacy_compatibility (pie_readiness_id);

ALTER TABLE public.pie_legacy_compatibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pie_legacy_compatibility_owner_select
  ON public.pie_legacy_compatibility;
CREATE POLICY pie_legacy_compatibility_owner_select
  ON public.pie_legacy_compatibility
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pie_legacy_compatibility_service_select
  ON public.pie_legacy_compatibility;
CREATE POLICY pie_legacy_compatibility_service_select
  ON public.pie_legacy_compatibility
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS pie_legacy_compatibility_service_insert
  ON public.pie_legacy_compatibility;
CREATE POLICY pie_legacy_compatibility_service_insert
  ON public.pie_legacy_compatibility
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_legacy_compatibility_service_update
  ON public.pie_legacy_compatibility;
CREATE POLICY pie_legacy_compatibility_service_update
  ON public.pie_legacy_compatibility
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS pie_legacy_compatibility_service_delete
  ON public.pie_legacy_compatibility;
CREATE POLICY pie_legacy_compatibility_service_delete
  ON public.pie_legacy_compatibility
  FOR DELETE
  TO service_role
  USING (true);

-- Compatibility read contract.
-- Existing legacy values are returned exactly as stored.
-- PIE metadata is returned separately so consumers can compare the two
-- systems without silently replacing legacy behaviour.

CREATE OR REPLACE FUNCTION public.get_performance_intelligence_compat(
  p_user_id UUID
)
RETURNS TABLE (
  source_of_truth TEXT,
  compatibility_status TEXT,

  readiness_score NUMERIC,
  clinical_accuracy NUMERIC,
  answer_stability NUMERIC,
  time_management NUMERIC,
  confidence_calibration NUMERIC,
  distance_from_ideal NUMERIC,
  attempt_count INTEGER,
  readiness_updated_at TIMESTAMPTZ,

  pie_readiness_available BOOLEAN,
  pie_target_probability NUMERIC,
  pie_readiness_lower_bound NUMERIC,
  pie_readiness_upper_bound NUMERIC,
  pie_readiness_uncertainty NUMERIC,
  pie_model_version TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(c.source_of_truth, 'LEGACY')::TEXT,
    COALESCE(c.compatibility_status, 'SHADOW')::TEXT,

    r.readiness_score,
    r.clinical_accuracy,
    r.answer_stability,
    r.time_management,
    r.confidence_calibration,
    r.distance_from_ideal,
    r.attempt_count,
    r.updated_at,

    (pr.id IS NOT NULL),
    pr.target_probability,
    pr.lower_bound,
    pr.upper_bound,
    pr.uncertainty_measure,
    pr.model_version
  FROM (
    SELECT *
    FROM public.readiness_dna
    WHERE user_id = p_user_id
  ) r
  LEFT JOIN public.pie_legacy_compatibility c
    ON c.user_id = p_user_id
   AND c.compatibility_context = 'PERFORMANCE_INTELLIGENCE'
  LEFT JOIN public.pie_exam_readiness pr
    ON pr.id = c.pie_readiness_id;
END;
$$;

COMMENT ON FUNCTION public.get_performance_intelligence_compat(UUID) IS
  'Non-destructive compatibility read contract. Legacy readiness remains authoritative; PIE readiness is returned as shadow metadata until explicitly promoted.';

REVOKE ALL ON FUNCTION public.get_performance_intelligence_compat(UUID)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_performance_intelligence_compat(UUID)
  TO authenticated, service_role;

-- Explicitly prevent the PIE compatibility layer from replacing the legacy
-- trigger or writing directly into legacy derived intelligence.
-- Legacy trigger behaviour remains unchanged by P1.5.
