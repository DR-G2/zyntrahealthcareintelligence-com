#!/usr/bin/env bash
# Throwaway local Postgres test for 0082 (pie.decide subject cap). Needs PostgreSQL binaries (tested on 17).
set -euo pipefail
cd "$(dirname "$0")"
BIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | tail -1)}
D=$(mktemp -d); PORT=${PORT:-55432}
"$BIN/initdb" -D "$D" -U postgres -A trust >/dev/null
"$BIN/pg_ctl" -D "$D" -o "-p $PORT -k $D" -l "$D/log" start >/dev/null
trap '"$BIN/pg_ctl" -D "$D" stop -m fast >/dev/null; rm -rf "$D"' EXIT
P="psql -X -h $D -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q --set=client_min_messages=notice"
$P -f ../live_replica/supabase_stub.sql >/dev/null
$P -f schema_stub.sql >/dev/null
$P -f live_rank_candidates.sql >/dev/null
$P -c "revoke all on function pie.rank_candidates(uuid,uuid,text,text,uuid[],uuid[]) from public, anon, authenticated; grant execute on function pie.rank_candidates(uuid,uuid,text,text,uuid[],uuid[]) to service_role;" >/dev/null
$P -f ../../migrations_v2/0082_pie_subject_session_cap.sql >/dev/null
$P -f tests.sql
