-- P8/P10 learner-facing RPC grants.
-- Scope: only the two self-scoped SECURITY DEFINER wrappers; no underlying table grants.
-- Both functions enforce auth.uid() and return only the caller's own inference/readiness.
-- Review and apply through the approved V2 migration process; this file alone changes no live DB.

begin;

revoke all on function public.get_my_pie_inference() from public, anon;
grant execute on function public.get_my_pie_inference() to authenticated;

revoke all on function public.get_my_amc_readiness(text) from public, anon;
grant execute on function public.get_my_amc_readiness(text) to authenticated;

commit;
