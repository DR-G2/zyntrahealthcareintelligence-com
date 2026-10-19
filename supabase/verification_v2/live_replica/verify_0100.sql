-- LOCAL/CI ONLY. Verify Behaviour schema, RLS and read/write boundaries on disposable replica.
\set ON_ERROR_STOP on
do $$
begin
  if to_regclass('intelligence.behavior_profiles') is null then raise exception 'FAIL 0100 Behaviour table missing'; end if;
  if to_regclass('public.my_behavior_profile') is null then raise exception 'FAIL 0100 caller-owned Behaviour view missing'; end if;
  if not (select c.relrowsecurity from pg_class c where c.oid='intelligence.behavior_profiles'::regclass) then raise exception 'FAIL 0100 Behaviour RLS disabled'; end if;
  if not exists (select 1 from pg_policies where schemaname='intelligence' and tablename='behavior_profiles' and policyname='behavior_profiles_select_own' and cmd='SELECT') then raise exception 'FAIL 0100 own-user read policy missing'; end if;
  if not has_table_privilege('authenticated','public.my_behavior_profile','select') then raise exception 'FAIL 0100 authenticated view grant missing'; end if;
  if has_table_privilege('anon','public.my_behavior_profile','select') then raise exception 'FAIL 0100 anonymous view access enabled'; end if;
  if not has_table_privilege('authenticated','intelligence.behavior_profiles','select') then raise exception 'FAIL 0100 RLS-filtered base read grant missing'; end if;
  if has_table_privilege('authenticated','intelligence.behavior_profiles','insert') then raise exception 'FAIL 0100 learner profile write enabled'; end if;
  if not has_table_privilege('service_role','intelligence.behavior_profiles','insert') or not has_table_privilege('service_role','intelligence.behavior_profiles','update') then raise exception 'FAIL 0100 trusted service write grants missing'; end if;
  if not has_table_privilege('service_role','command.manual_overrides','select') then raise exception 'FAIL 0100 trusted entitlement lookup grant missing'; end if;
  if not (select reloptions @> array['security_invoker=true'] from pg_class where oid='public.my_behavior_profile'::regclass) then raise exception 'FAIL 0100 view is not security invoker'; end if;
  raise notice 'ALL 0100 BEHAVIOUR CONTRACT ASSERTIONS PASSED';
end $$;
