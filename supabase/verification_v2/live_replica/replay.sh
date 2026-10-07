#!/usr/bin/env bash
# LOCAL ONLY: rebuild a faithful replica of the live V2 schema in a throwaway Postgres
# and (optionally) apply 0044 + run the two-user verification.
#
#   PGHOST=/path/to/socket PGPORT=5432 PGUSER=postgres ./replay.sh [db_name] [--with-0044] [--verify]
#
# OWNER_ROLE=<name> (default zyntra_owner) is created NOSUPERUSER/BYPASSRLS/CREATEROLE and
# owns the database and every migrated object, mirroring Supabase where the non-superuser
# "postgres" role runs migrations. PGUSER must be a superuser (only for the platform stub).
#
# Replays migrations_v2/live_applied/LIVE_ORDER.tsv in live order, each file in its own
# transaction (as Supabase apply_migration does), after a minimal Supabase role/auth stub.
# Never point this at the live project.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mig="$here/../../migrations_v2"
db="${1:-v2_live_replica}"; shift || true
owner="${OWNER_ROLE:-zyntra_owner}"
psql_su() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }
psql_db() { psql -X -q -v ON_ERROR_STOP=1 -U "$owner" -d "$db" "$@"; }

psql -X -q -d postgres -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='$owner') then
    create role $owner login nosuperuser createrole bypassrls inherit;
  end if; end \$\$;"
psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db owner $owner"
# Roles are cluster-wide; tolerate them already existing from a previous replica.
psql -X -q -d postgres -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if;
end \$\$;" -c "grant anon, authenticated, service_role to authenticator" \
  -c "grant anon, authenticated, service_role to $owner" -c "grant authenticator to $owner with admin option"
grep -v '^create role\|^grant anon, authenticated, service_role to authenticator' "$here/supabase_stub.sql" \
  | sed "s/^alter default privileges in schema public/alter default privileges for role $owner in schema public/" | psql_su
psql_su -c "grant usage, create on schema extensions to $owner" -c "grant usage on schema auth to $owner" -c "grant all on all tables in schema auth to $owner" -c "grant set on parameter pgrst.db_schemas to $owner" -c "alter database $db set search_path = public, extensions"

n=0
while IFS=$'\t' read -r version name file sum; do
  [[ "$version" =~ ^# ]] && continue
  actual=$(md5sum < "$mig/$file" | cut -c1-32)
  [[ "$actual" == "$sum" ]] || { echo "checksum mismatch for $file" >&2; exit 1; }
  psql_db -1 -f "$mig/$file" >/dev/null 2>&1 || { echo "FAILED: $version $name ($file)" >&2; psql_db -1 -f "$mig/$file"; exit 1; }
  n=$((n+1))
done < "$mig/live_applied/LIVE_ORDER.tsv"
echo "replayed $n live migrations into $db"

for arg in "$@"; do
  case "$arg" in
    --with-0044) psql_su -f "$here/seed.sql"; psql_db -1 -f "$mig/0044_pie_candidate_state_pipeline_repair.sql"; echo "applied 0044";;
    --verify) psql -X -d "$db" -f "$here/verify_0044.sql";;
  esac
done
