-- The authenticated wrapper already binds rebuild_candidate to auth.uid().
-- Allow that same-candidate call while preserving service_role cross-candidate access.
-- Fail closed if the deployed function body has drifted from the known migration.
do $migration$
declare
  v_definition text;
  v_patched text;
  v_old text := 'if auth.role() <> ''service_role'' then raise exception ''Service role required''; end if;';
  v_new text := 'if auth.role() <> ''service_role'' and (auth.uid() is null or auth.uid() <> p_user_id) then raise exception ''Candidate scope violation''; end if;';
begin
  select pg_get_functiondef('intelligence.rebuild_candidate(uuid)'::regprocedure)
    into v_definition;
  if position(v_old in v_definition) = 0 then
    raise exception 'Expected canonical intelligence guard not found; refusing to patch a drifted function';
  end if;
  v_patched := replace(v_definition, v_old, v_new);
  if v_patched = v_definition then
    raise exception 'Canonical intelligence guard patch made no change';
  end if;
  execute v_patched;
end
$migration$;

-- Internal rebuild remains unavailable to direct authenticated callers.
revoke all on function intelligence.rebuild_candidate(uuid) from public, anon, authenticated;
grant execute on function intelligence.rebuild_candidate(uuid) to service_role;

-- This wrapper is the only authenticated entry point and always uses auth.uid().
revoke all on function public.refresh_candidate_intelligence() from public, anon;
grant execute on function public.refresh_candidate_intelligence() to authenticated;
