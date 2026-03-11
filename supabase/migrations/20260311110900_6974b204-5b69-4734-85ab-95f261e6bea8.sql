
CREATE TABLE public.ai_feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  plan jsonb DEFAULT '{}',
  generated_code jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_feature_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_patch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_request_id uuid REFERENCES public.ai_feature_requests(id),
  files_modified jsonb DEFAULT '[]',
  changes jsonb DEFAULT '{}',
  approved_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_patch_logs ENABLE ROW LEVEL SECURITY;
