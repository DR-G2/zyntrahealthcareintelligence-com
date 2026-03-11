CREATE TABLE public.system_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  overall_status text NOT NULL DEFAULT 'healthy',
  mode text NOT NULL DEFAULT 'standard',
  steps jsonb NOT NULL DEFAULT '[]',
  total_latency_ms integer NOT NULL DEFAULT 0
);

ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;