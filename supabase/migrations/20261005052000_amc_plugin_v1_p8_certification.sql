-- P8 AMC Plugin certification gate.
CREATE TABLE IF NOT EXISTS public.amc_certification_gate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_version_id UUID NOT NULL REFERENCES public.amc_plugin_version(id) ON DELETE RESTRICT,
  gate_level INTEGER NOT NULL CHECK (gate_level BETWEEN 0 AND 3),
  status TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED','PASSED','FAILED','BLOCKED','REVOKED')),
  required_validation_types TEXT[] NOT NULL DEFAULT '{}',
  evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  blocking_reasons TEXT[] NOT NULL DEFAULT '{}',
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plugin_version_id, gate_level)
);

CREATE OR REPLACE FUNCTION public.amc_promotion_allowed(p_plugin_version_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RETURN false;
  END IF;
  SELECT status INTO v_status
  FROM public.amc_certification_gate
  WHERE plugin_version_id = p_plugin_version_id
    AND gate_level = 2;
  RETURN COALESCE(v_status = 'PASSED', false);
END;
$$;

REVOKE ALL ON FUNCTION public.amc_promotion_allowed(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amc_promotion_allowed(UUID) TO service_role;

ALTER TABLE public.amc_certification_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.amc_certification_gate FROM anon, authenticated;
GRANT ALL ON public.amc_certification_gate TO service_role;
DROP POLICY IF EXISTS amc_certification_gate_service_all ON public.amc_certification_gate;
CREATE POLICY amc_certification_gate_service_all ON public.amc_certification_gate
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gate definitions. No automatic PASS is assigned.
INSERT INTO public.amc_certification_gate
(plugin_version_id, gate_level, status, required_validation_types)
SELECT p.id, v.level, 'PROPOSED', v.types
FROM public.amc_plugin_version p
CROSS JOIN (VALUES
 (0, ARRAY['AMC_SPEC','BLUEPRINT','SECURITY']::text[]),
 (1, ARRAY['PSYCHOMETRIC_EXTERNAL','SYNTHETIC','INTEGRATION']::text[]),
 (2, ARRAY['AMC_SPEC','BLUEPRINT','PSYCHOMETRIC_EXTERNAL','SYNTHETIC','SECURITY','INTEGRATION']::text[]),
 (3, ARRAY['AMC_SPEC','BLUEPRINT','PSYCHOMETRIC_EXTERNAL','SYNTHETIC','SECURITY','INTEGRATION']::text[])
) v(level,types)
WHERE p.plugin_code='AMC' AND p.plugin_version='1.0.0'
ON CONFLICT (plugin_version_id, gate_level) DO NOTHING;

COMMENT ON TABLE public.amc_certification_gate IS
'AMC plugin certification. Gate status is evidence-driven and never auto-promoted.';
