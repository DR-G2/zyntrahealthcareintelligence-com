-- 0097: Explicit least-privilege correction for the session-scoped PIE trace RPC.
-- 0096 created the RPC and granted authenticated execution. Remove any inherited/default
-- service_role grant, then refresh PostgREST's schema cache.
revoke all on function public.get_my_pie_decision_traces_for_session(uuid) from service_role;
notify pgrst, 'reload schema';
