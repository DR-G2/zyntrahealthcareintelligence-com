#!/usr/bin/env bash
# LOCAL ONLY. Replays live V2 schema + 0044, applies 0045-0051 (incl. 0050 seed, which maps
# nothing on a DB without the live content), P1/P2 fixtures, then P3 stage assertions.
#   PGHOST=/tmp PGPORT=55434 PGUSER=supabase_admin OWNER_ROLE=postgres ./run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; mig="$here/../../migrations_v2"; db="${1:-v2_p3}"
owner="${OWNER_ROLE:-zyntra_owner}"
"$here/../live_replica/replay.sh" "$db" --with-0044
for f in 0045_pie_p1_content_lo_model.sql 0046_pie_p2_learner_lo_state.sql 0047_pie_deprecate_shadow.sql \
         0048_pie_p2_review_fixes.sql 0049_pie_p3_readiness_to_amc.sql 0050_pie_p3_seed_lo_map_irt.sql \
         0051_pie_p3_candidate_pool.sql; do
  psql -X -q -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/$f"; echo "applied $f"
done
psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/../pie_p1_p2/fixtures.sql"
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/verify_p3.sql"
