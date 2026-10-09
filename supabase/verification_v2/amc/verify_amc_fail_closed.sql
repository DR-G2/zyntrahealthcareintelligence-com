-- LOCAL / staging verification only. Run after 0062_amc_blueprint_fail_closed.sql.
-- Never apply this script to production: it creates a disposable test session.
\set ON_ERROR_STOP 1
\pset tuples_only on
\set U '''99999999-0000-0000-0000-000000000062'''

create or replace function pg_temp.amc_as_user(u uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true)
$$;

select public.t_assert(
  exists(select 1 from amc.amc_blueprint where blueprint_key='ZYNTRA_GENERAL' and version='GENERAL_V1'),
  'exam-neutral general blueprint is seeded'
);

-- AMC session creation must refuse while the AMC blueprint has no eligible LO mappings.
begin;
select pg_temp.amc_as_user(:U) \g /dev/null
set local role authenticated;
do $$
begin
  begin
    perform * from public.pie_create_session(1, 'AMC_CAT_MCQ', 'pie_adaptive');
    raise exception 'FAIL: AMC session should have been blocked without reviewed mappings';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'AMC_BLUEPRINT_MAPPING_REQUIRED' then raise; end if;
  end;
end $$;
rollback;

-- Generic PIE practice must still work with its explicit exam-neutral blueprint.
begin;
select pg_temp.amc_as_user(:U) \g /dev/null
set local role authenticated;
select session_id as general_session, question_count as general_count
from public.pie_create_session(1, 'ZYNTRA_GENERAL', 'pie_adaptive') \gset
commit;
select public.t_assert(:general_count >= 1, 'generic practice remains available');
select public.t_assert(
  (select config->>'blueprint_key' from public.practice_sessions where id=:'general_session') = 'ZYNTRA_GENERAL',
  'generic session does not masquerade as AMC'
);

\echo 'AMC fail-closed selector boundary assertions passed'
