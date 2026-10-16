#!/usr/bin/env bash
# LOCAL ONLY: run full-history regression tests on a disposable replica.
# Never point this script at production.
# Example:
#   PGHOST=/tmp PGPORT=55434 PGUSER=supabase_admin OWNER_ROLE=postgres ./run_0088.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mig="$here/../../migrations_v2"
db="${1:-v2_verify_0088}"
owner="${OWNER_ROLE:-zyntra_owner}"

"$here/replay.sh" "$db" --with-0044
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0088_pie_candidate_state_full_history.sql"
echo "applied 0088_pie_candidate_state_full_history.sql to disposable replica"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -f "$here/verify_0088.sql"
echo "PASS: 0088 full-history regression script completed"
