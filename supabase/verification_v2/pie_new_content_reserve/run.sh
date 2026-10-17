#!/usr/bin/env bash
# Throwaway local Postgres test for 0084 (pie.decide new-content reservation). Needs PostgreSQL binaries.
# 1) re-runs the 0083 subject-cap suite with 0084 applied (regression), 2) runs tests.sql (reservation).
set -euo pipefail
cd "$(dirname "$0")"
CAP=../pie_subject_cap
BIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | tail -1)}
D=$(mktemp -d); PORT=${PORT:-55433}
"$BIN/initdb" -D "$D" -U postgres -A trust >/dev/null
"$BIN/pg_ctl" -D "$D" -o "-p $PORT -k $D" -l "$D/log" start >/dev/null
trap '"$BIN/pg_ctl" -D "$D" stop -m fast >/dev/null; rm -rf "$D"' EXIT
P="psql -X -h $D -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q --set=client_min_messages=notice"
$P -f ../live_replica/supabase_stub.sql >/dev/null
$P -f $CAP/schema_stub.sql >/dev/null
$P -f $CAP/live_rank_candidates.sql >/dev/null
$P -c "revoke all on function pie.rank_candidates(uuid,uuid,text,text,uuid[],uuid[]) from public, anon, authenticated; grant execute on function pie.rank_candidates(uuid,uuid,text,text,uuid[],uuid[]) to service_role;" >/dev/null
$P -f ../../migrations_v2/0083_pie_subject_session_cap.sql >/dev/null
$P -f $CAP/live_pie_next_question.sql >/dev/null
$P -c "select proacl::text from pg_proc where oid='public.pie_create_session(integer,text,text)'::regprocedure" -tA > /tmp/pie_cs_acl_before.txt
$P -f ../../migrations_v2/0084_pie_new_content_reserve.sql >/dev/null
echo "== 0083 subject-cap suite with 0084 applied"
# the cap suite re-applies its migration after the T1b baseline; point that at 0084 instead
sed 's#\\i ../../migrations_v2/0083_pie_subject_session_cap.sql#\\i ../../migrations_v2/0084_pie_new_content_reserve.sql#' $CAP/tests.sql > $CAP/.tests_0084.sql
(cd $CAP && $P -f .tests_0084.sql); rm -f $CAP/.tests_0084.sql
echo "== 0084 reservation suite"
$P -f tests.sql
