-- LOCAL/CI ONLY. Verify additive explicit mode-provenance contract on the disposable replica.
\set ON_ERROR_STOP on
select public.t_assert(to_regprocedure('public.pie_create_practice_session(integer,text)') is not null,
  '0099 mode-aware creator exists');
select public.t_assert(to_regprocedure('public.get_my_attempt_history(integer,timestamptz,uuid)') is not null,
  '0099 history RPC exists');
select public.t_assert(position('practice_mode' in pg_get_functiondef('public.get_my_attempt_history(integer,timestamptz,uuid)'::regprocedure)) > 0,
  '0099 history RPC prefers explicit practice_mode');
select public.t_assert(position('auth.uid()' in pg_get_functiondef('public.pie_create_practice_session(integer,text)'::regprocedure)) > 0,
  '0099 session creator enforces caller identity');
select public.t_assert(exists (
  select 1 from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='pie' and c.relname='pie_observation'
    and t.tgname='pie_observation_practice_mode_provenance' and not t.tgisinternal
), '0099 observation provenance trigger exists');
select public.t_assert(position('pie_adaptive' in pg_get_functiondef('public.pie_create_practice_session(integer,text)'::regprocedure)) > 0,
  '0099 retains existing PIE selector mode');
select public.t_assert(has_function_privilege('authenticated','public.pie_create_practice_session(integer,text)','execute'),
  '0099 authenticated execution grant');
select public.t_assert(not has_function_privilege('anon','public.pie_create_practice_session(integer,text)','execute'),
  '0099 anonymous execution denied');
\echo 'ALL 0099 MODE PROVENANCE ASSERTIONS PASSED'
