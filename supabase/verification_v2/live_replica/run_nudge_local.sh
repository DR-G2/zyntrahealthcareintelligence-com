#!/usr/bin/env bash
# LOCAL ONLY: replay the deployed V2 schema into a throwaway PostgreSQL database,
# apply the PR's Nudge migrations, and run synthetic lifecycle checks.
# Never point this script at a hosted or production database.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mig="$here/../../migrations_v2"
db="v2_verify_nudge_lifecycle"
owner="${OWNER_ROLE:-zyntra_owner}"

"$here/replay.sh" "$db" --with-0044
for file in \
  0091_nudge_pie_authoritative_target_selector.sql \
  0092_nudge_targeted_session_lifecycle.sql \
  0095_nudge_cold_start_progression.sql \\\n  0096_pie_runtime_query_hardening.sql; do
  echo "Applying $file to disposable database $db"
  psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/$file"
done
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -f "$here/verify_nudge_lifecycle.sql"
echo "PASS: Nudge cold-start, threshold transition, targeted session, authoritative saves, reassessment improvement, and candidate isolation"
