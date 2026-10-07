#!/usr/bin/env bash
# LOCAL ONLY. Replays the live V2 schema (live_applied order) + 0044, then 0045-0047,
# fixtures and assertions, in a throwaway Postgres. Never point at the live project.
#   PGHOST=/tmp PGPORT=55434 PGUSER=supabase_admin OWNER_ROLE=postgres ./run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; mig="$here/../../migrations_v2"; db="${1:-v2_p1_p2}"
owner="${OWNER_ROLE:-zyntra_owner}"
"$here/../live_replica/replay.sh" "$db" --with-0044
for f in 0045_pie_p1_content_lo_model.sql 0046_pie_p2_learner_lo_state.sql 0047_pie_deprecate_shadow.sql 0048_pie_p2_review_fixes.sql; do
  psql -X -q -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/$f"; echo "applied $f"
done
psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/fixtures.sql"
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/verify_p1_p2.sql"
