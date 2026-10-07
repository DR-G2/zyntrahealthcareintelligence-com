#!/usr/bin/env bash
# LOCAL ONLY. Real-concurrency tests: N parallel psql connections released together by an
# advisory-lock barrier. Run after run.sh against the same throwaway DB.
#   PGHOST=/tmp PGPORT=55434 PGUSER=supabase_admin ./race.sh [db]
set -euo pipefail
db="${1:-v2_p3}"; N="${N:-8}"; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
q() { psql -X -q -At -v ON_ERROR_STOP=1 -d "$db" "$@"; }
E=eeeeeeee-0000-0000-0000-00000000000e; F=ffffffff-0000-0000-0000-00000000000f
q -c "insert into auth.users(id,email) values ('$E','e@t'),('$F','f@t') on conflict do nothing" \
  -c "insert into public.profiles(id,email,role,status) values ('$E','e@t','learner','active'),('$F','f@t','learner','active') on conflict do nothing"
as() { echo "select set_config('request.jwt.claims','{\"sub\":\"$1\",\"role\":\"authenticated\"}',false); set role authenticated;"; }

# barrier: holder takes the exclusive lock; workers wait on the shared lock, then all run.
barrier_run() { # $1 = sql to run per worker
  q -c "select pg_advisory_lock(424242); select pg_sleep(2); select pg_advisory_unlock(424242);" >/dev/null &
  local holder=$!; sleep 0.5
  for i in $(seq 1 "$N"); do
    ( psql -X -q -At -d "$db" -c "select pg_advisory_lock_shared(424242); select pg_advisory_unlock_shared(424242);" \
        -c "$(as "$2")" -c "$1" >"$tmp/out.$i" 2>"$tmp/err.$i"; echo $? >"$tmp/rc.$i" ) &
  done
  wait
  ok=0; for i in $(seq 1 "$N"); do [[ "$(cat "$tmp/rc.$i")" == 0 ]] && ok=$((ok+1)); done; echo "$ok"
}

echo "### R1 $N parallel save_attempt on the same session question -> exactly one success"
# a PIE session (save_attempt accepts PIE-registered sessions only from 0059)
SID=$(q -c "$(as $E)" -c "select session_id from public.pie_create_session(1)" | tail -1)
QID=$(q -c "select question_id from public.practice_session_questions where session_id='$SID'")
ok=$(barrier_run "select (public.save_attempt('$QID','$SID','A',false)).is_correct" $E)
n=$(q -c "select count(*) from public.user_attempts where session_id='$SID'")
dup=$(cat "$tmp"/err.* | grep -c "already answered" || true)
echo "successes=$ok rows=$n rejected_already_answered=$dup"
[[ "$ok" == 1 && "$n" == 1 && "$dup" == $((N-1)) ]] || { echo "FAIL R1"; cat "$tmp"/err.*; exit 1; }

echo "### R2 $N parallel pie_create_session (fresh learner) -> exactly one success (throttle)"
ok=$(barrier_run "select session_id from public.pie_create_session(1)" $F)
n=$(q -c "select count(*) from pie.adaptive_session where user_id='$F'")
echo "successes=$ok sessions=$n"
[[ "$ok" == 1 && "$n" == 1 ]] || { echo "FAIL R2"; cat "$tmp"/err.*; exit 1; }

echo "### R3 cap under concurrency: 2 active, throttle cleared, $N parallel creates -> 3 active max"
q -c "delete from pie.session_create_throttle where user_id='$F'"
q -c "$(as $F)" -c "select session_id from public.pie_create_session(1)" >/dev/null
q -c "delete from pie.session_create_throttle where user_id='$F'"
ok=$(barrier_run "select session_id from public.pie_create_session(1)" $F)
n=$(q -c "select count(*) from pie.adaptive_session a join public.practice_sessions ps on ps.id=a.session_id where a.user_id='$F' and ps.status='active'")
echo "successes=$ok active=$n"
[[ "$ok" == 1 && "$n" == 3 ]] || { echo "FAIL R3"; cat "$tmp"/err.*; exit 1; }
q -c "delete from pie.session_create_throttle where user_id='$F'"
ok=$(barrier_run "select session_id from public.pie_create_session(1)" $F)
n=$(q -c "select count(*) from pie.adaptive_session a join public.practice_sessions ps on ps.id=a.session_id where a.user_id='$F' and ps.status='active'")
echo "at cap: successes=$ok active=$n"
[[ "$ok" == 0 && "$n" == 3 ]] || { echo "FAIL R3 cap"; cat "$tmp"/err.*; exit 1; }
if [[ "$(q -c "select count(*) from pg_proc where proname='pie_create_session' and pronargs=3")" == 1 ]]; then
  echo "### R4 $N parallel diagnostic creates (fresh learner) -> exactly one diagnostic"
  G=99999999-0000-0000-0000-0000000000ee
  q -c "insert into auth.users(id,email) values ('$G','g@t') on conflict do nothing" \
    -c "insert into public.profiles(id,email,role,status) values ('$G','g@t','learner','active') on conflict do nothing"
  ok=$(barrier_run "select session_id from public.pie_create_session(10,'AMC_CAT_MCQ','pie_diagnostic')" $G)
  n=$(q -c "select count(*) from pie.adaptive_session where user_id='$G' and mode='diagnostic'")
  echo "successes=$ok diagnostics=$n"
  [[ "$ok" == 1 && "$n" == 1 ]] || { echo "FAIL R4"; cat "$tmp"/err.*; exit 1; }
fi
echo "ALL RACE TESTS PASSED"
