-- 0061: selector-failure RAISE LOG redaction switch (Hank follow-up). LOCAL-VERIFIED ONLY.
--  The 0054 log line carried learner and session ids. Default is now STRIPPED (event only),
--  pending Saul / Mr. G. A single switch re-enables ids for incident debugging:
--    update pie.runtime_flag set enabled = true where flag = 'log_selector_identifiers';
--  Counts (pie.selector_failure_stats) are unaffected.

create table if not exists pie.runtime_flag (
  flag text primary key,
  enabled boolean not null,
  note text,
  updated_at timestamptz not null default now()
);
alter table pie.runtime_flag enable row level security;
revoke all on pie.runtime_flag from public, anon, authenticated;
grant select, update on pie.runtime_flag to service_role;
insert into pie.runtime_flag(flag, enabled, note)
values ('log_selector_identifiers', false, 'Include learner/session ids in PIE_NO_ELIGIBLE_CANDIDATE log lines. Default off pending Saul/Mr. G.')
on conflict (flag) do nothing;

create or replace function pie.selector_failure_log_line(p_user uuid, p_session uuid, p_event text)
returns text language sql stable security definer set search_path = '' as $$
  select case when coalesce((select f.enabled from pie.runtime_flag f where f.flag = 'log_selector_identifiers'), false)
              then format('PIE_NO_ELIGIBLE_CANDIDATE learner=%s session=%s event=%s', p_user, p_session, p_event)
              else format('PIE_NO_ELIGIBLE_CANDIDATE event=%s', p_event) end
$$;
revoke all on function pie.selector_failure_log_line(uuid, uuid, text) from public, anon, authenticated;

create or replace function pie.note_selector_failure(p_user uuid, p_session uuid, p_event text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.nextval('pie.selector_failure_seq');
  raise log '%', pie.selector_failure_log_line(p_user, p_session, p_event);
end $$;
revoke all on function pie.note_selector_failure(uuid, uuid, text) from public, anon, authenticated;
