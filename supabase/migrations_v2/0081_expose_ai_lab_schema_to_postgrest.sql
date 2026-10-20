-- Expose the AI Lab schema to PostgREST so service-role Edge Function queries
-- using .schema('ai_lab') are accepted. Table grants and RLS remain unchanged.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public,storage,graphql_public,pie,command,ai_lab';
NOTIFY pgrst, 'reload config';
