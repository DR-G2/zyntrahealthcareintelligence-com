
alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,pie';
notify pgrst, 'reload config';
