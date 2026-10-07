-- 0047: retire PIE shadow artefacts in V2 (ruling: no shadow or parallel selector).
-- pie.pie_shadow_run had 0 rows live (7 Oct 2026). Kept for audit history, sealed
-- from every non-service role. The shadow edge functions are removed from the repo.
revoke all on pie.pie_shadow_run from public, anon, authenticated;
comment on table pie.pie_shadow_run is
  'DEPRECATED (0047): shadow pipeline retired. Must not be written. Drop after Gus release gate.';
create or replace function pie.forbid_shadow_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'pie_shadow_run is retired (0047)' using errcode = '55000';
end $$;
drop trigger if exists pie_shadow_run_retired on pie.pie_shadow_run;
create trigger pie_shadow_run_retired before insert or update on pie.pie_shadow_run
  for each row execute function pie.forbid_shadow_write();
revoke all on function pie.forbid_shadow_write() from public, anon, authenticated;
update pie.pie_model_version set status = 'retired' where status = 'shadow';
