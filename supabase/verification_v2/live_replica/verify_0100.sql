-- LOCAL/CI ONLY. Verify Behaviour schema, RLS and read/write boundaries on disposable replica.
\set ON_ERROR_STOP on
select public.t_assert(to_regclass('intelligence.behavior_profiles') is not null, '0100 Behaviour table exists');
select public.t_assert(to_regclass('public.my_behavior_profile') is not null, '0100 caller-owned Behaviour view exists');
select public.t_assert((select c.relrowsecurity from pg_class c where c.oid='intelligence.behavior_profiles'::regclass), '0100 Behaviour RLS enabled');
select public.t_assert(exists (
  select 1 from pg_policies where schemaname='intelligence' and tablename='behavior_profiles'
    and policyname='behavior_profiles_select_own' and cmd='SELECT'
), '0100 own-user read policy exists');
select public.t_assert(has_table_privilege('authenticated','public.my_behavior_profile','select'), '0100 authenticated can read own view');
select public.t_assert(not has_table_privilege('anon','public.my_behavior_profile','select'), '0100 anonymous view access denied');
select public.t_assert(has_table_privilege('authenticated','intelligence.behavior_profiles','select'), '0100 RLS-filtered base read grant exists');
select public.t_assert(not has_table_privilege('authenticated','intelligence.behavior_profiles','insert'), '0100 learners cannot write profiles');
select public.t_assert(has_table_privilege('service_role','intelligence.behavior_profiles','insert')
  and has_table_privilege('service_role','intelligence.behavior_profiles','update'), '0100 trusted service can write profiles');
select public.t_assert(has_table_privilege('service_role','command.manual_overrides','select'), '0100 trusted service can verify manual entitlements');
select public.t_assert((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.my_behavior_profile'::regclass), '0100 view uses invoker security');
\echo 'ALL 0100 BEHAVIOUR CONTRACT ASSERTIONS PASSED'
