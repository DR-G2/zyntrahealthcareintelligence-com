-- LOCAL/CI ONLY. Verify explicit mode-provenance contract on disposable replica.
\set ON_ERROR_STOP on
do $$
begin
  if to_regclass('pie.practice_session_mode') is null then raise exception 'FAIL 0099 trusted mode registry missing'; end if;
  if has_table_privilege('authenticated','pie.practice_session_mode','insert') or has_table_privilege('authenticated','pie.practice_session_mode','select') then raise exception 'FAIL 0099 learners can access trusted mode registry'; end if;
  if to_regprocedure('public.pie_create_practice_session(integer,text)') is null then raise exception 'FAIL 0099 mode-aware creator missing'; end if;
  if to_regprocedure('public.get_my_attempt_history(integer,timestamptz,uuid)') is null then raise exception 'FAIL 0099 history RPC missing'; end if;
  if position('sm.practice_mode' in pg_get_functiondef('public.get_my_attempt_history(integer,timestamptz,uuid)'::regprocedure)) = 0 then raise exception 'FAIL 0099 history RPC does not use trusted mode registry'; end if;
  if position('pie.practice_session_mode' in pg_get_functiondef('pie._tag_observation_practice_mode()'::regprocedure)) = 0 then raise exception 'FAIL 0099 observation tagger does not use trusted mode registry'; end if;
  if position('pie.practice_session_mode' in pg_get_functiondef('public.create_my_nudge_session(integer)'::regprocedure)) = 0 then raise exception 'FAIL 0099 Nudge creator does not register trusted mode'; end if;
  if position('auth.uid()' in pg_get_functiondef('public.pie_create_practice_session(integer,text)'::regprocedure)) = 0 then raise exception 'FAIL 0099 creator does not enforce caller identity'; end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='pie' and c.relname='pie_observation' and t.tgname='pie_observation_practice_mode_provenance' and not t.tgisinternal
  ) then raise exception 'FAIL 0099 observation provenance trigger missing'; end if;
  if position('pie_adaptive' in pg_get_functiondef('public.pie_create_practice_session(integer,text)'::regprocedure)) = 0 then raise exception 'FAIL 0099 did not preserve PIE selector'; end if;
  if not has_function_privilege('authenticated','public.pie_create_practice_session(integer,text)','execute') then raise exception 'FAIL 0099 authenticated execution grant missing'; end if;
  if has_function_privilege('anon','public.pie_create_practice_session(integer,text)','execute') then raise exception 'FAIL 0099 anonymous execution is enabled'; end if;
  raise notice 'ALL 0099 MODE PROVENANCE ASSERTIONS PASSED';
end $$;
