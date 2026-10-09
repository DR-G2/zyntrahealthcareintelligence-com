-- LOCAL / staging verification only. Run after 0065_amc_readiness_no_unvalidated_composite.sql.
-- The candidate RPC contract must never expose an unvalidated scalar index or pass probability.
\set ON_ERROR_STOP 1
\pset tuples_only on
\set U '''99999999-0000-0000-0000-000000000064'''

insert into auth.users(id,email)
values ('99999999-0000-0000-0000-000000000064','amc-readiness-boundary@test.local')
on conflict do nothing;

begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub','99999999-0000-0000-0000-000000000064','role','authenticated')::text,
  true
) \g /dev/null
set local role authenticated;

do $$
DECLARE
  v_rebuilt jsonb;
  v_read jsonb;
BEGIN
  v_rebuilt := public.rebuild_my_amc_readiness('MCQ');
  IF v_rebuilt #> '{readiness,probability}' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL: rebuild returned a pass probability';
  END IF;
  IF v_rebuilt #>> '{readiness,status}' <> 'INSUFFICIENT_EVIDENCE' THEN
    RAISE EXCEPTION 'FAIL: rebuild returned a non-blocked readiness status';
  END IF;
  IF v_rebuilt ? 'index' OR v_rebuilt ? 'uncertainty' OR v_rebuilt ? 'evidence_count' THEN
    RAISE EXCEPTION 'FAIL: rebuild returned internal composite/readiness evidence';
  END IF;

  v_read := public.get_my_amc_readiness('MCQ');
  IF v_read #> '{readiness,probability}' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL: read RPC returned a pass probability';
  END IF;
  IF v_read ? 'index' OR v_read ? 'uncertainty' OR v_read ? 'evidence' THEN
    RAISE EXCEPTION 'FAIL: read RPC returned internal readiness fields';
  END IF;
END $$;

rollback;

SELECT public.t_assert(
  NOT has_function_privilege('anon','public.get_my_amc_readiness(text)','execute'),
  'anonymous role cannot execute AMC readiness RPC'
);
\echo 'AMC readiness boundary assertions passed'
