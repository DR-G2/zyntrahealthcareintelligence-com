#!/usr/bin/env bash
# Throwaway local Postgres test for 0083 (pie.decide subject cap). Needs PostgreSQL binaries (tested on 17).
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
$P -f live_pie_create_session.sql >/dev/null
$P -f live_pie_next_question.sql >/dev/null
$P -c "revoke all on function public.pie_create_session(integer,text,text) from public, anon; grant execute on function public.pie_create_session(integer,text,text) to authenticated, service_role;" >/dev/null
$P -c "select proacl::text from pg_proc where oid='public.pie_create_session(integer,text,text)'::regprocedure" -tA > /tmp/pie_cs_acl_before.txt
$P -f ../../migrations_v2/0083_pie_subject_session_cap.sql >/dev/null
$P -f tests.sql
