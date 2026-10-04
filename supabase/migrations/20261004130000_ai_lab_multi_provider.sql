ALTER TABLE public.ai_lab_connections DROP CONSTRAINT IF EXISTS ai_lab_connections_provider_check;
ALTER TABLE public.ai_lab_connections ADD CONSTRAINT ai_lab_connections_provider_check CHECK (provider IN ('openai','gemini','groq','openrouter'));
ALTER TABLE public.ai_lab_sessions DROP CONSTRAINT IF EXISTS ai_lab_sessions_provider_check;
ALTER TABLE public.ai_lab_sessions ADD CONSTRAINT ai_lab_sessions_provider_check CHECK (provider IN ('openai','gemini','groq','openrouter'));
