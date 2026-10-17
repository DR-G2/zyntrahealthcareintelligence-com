-- Trusted legacy-to-V2 identity mapping for candidate intelligence.
-- Only the server-side auth bridge (service_role) can write/read this table.
create table if not exists public.pie_identity_map (
  legacy_user_id uuid primary key,
  v2_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pie_identity_map enable row level security;
revoke all on table public.pie_identity_map from public, anon, authenticated;
grant select, insert, update on table public.pie_identity_map to service_role;

-- Patch the canonical rebuild so evidence is read from the legacy identity,
-- while all derived intelligence remains owned by the authenticated V2 identity.
do $migration$
declare
  v_definition text;
  v_patched text;
  v_old_count text := 'where user_id=p_user_id;';
  v_new_count text := 'where user_id=coalesce((select m.legacy_user_id from public.pie_identity_map m where m.v2_user_id=p_user_id),p_user_id);';
  v_old_subject text := 'where a.user_id=p_user_id';
  v_new_subject text := 'where a.user_id=coalesce((select m.legacy_user_id from public.pie_identity_map m where m.v2_user_id=p_user_id),p_user_id)';
begin
  select pg_get_functiondef('intelligence.rebuild_candidate(uuid)'::regprocedure)
    into v_definition;
  if position('public.pie_identity_map' in v_definition) > 0 then
    raise notice 'Identity mapping is already wired into canonical rebuild';
    return;
  end if;
  if position(v_old_count in v_definition) = 0 or position(v_old_subject in v_definition) = 0 then
    raise exception 'Canonical rebuild differs from expected definition; refusing unsafe patch';
  end if;
  v_patched := replace(v_definition, v_old_count, v_new_count);
  v_patched := replace(v_patched, v_old_subject, v_new_subject);
  if v_patched = v_definition then
    raise exception 'Identity mapping patch made no change';
  end if;
  execute v_patched;
end
$migration$;
