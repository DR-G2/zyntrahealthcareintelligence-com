#!/usr/bin/env bash
# LOCAL ONLY. P5 suite: (1) policy p5.0 + F1 + scheduler on the P1/P2 fixtures (db v2_p5);
# (2) C0 bank swap 0057 on a fresh replica (db v2_p5_bank). Never point at the live project.
#   PGHOST=/tmp PGPORT=55434 PGUSER=supabase_admin OWNER_ROLE=postgres ./run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; mig="$here/../../migrations_v2"
owner="${OWNER_ROLE:-zyntra_owner}"
MIGS="0045_pie_p1_content_lo_model.sql 0046_pie_p2_learner_lo_state.sql 0047_pie_deprecate_shadow.sql
 0048_pie_p2_review_fixes.sql 0049_pie_p3_readiness_to_amc.sql 0050_pie_p3_seed_lo_map_irt.sql
 0051_pie_p3_candidate_pool.sql 0052_pie_p3_review_fixes.sql 0053_pie_p3_peek_farm_fixes.sql
 0054_pie_p3_resume_cap_selector_stats.sql 0055_pie_p5_f1_question_key_columns.sql
 0056_pie_p5_review_scheduler_session_rules.sql"
P51="0058_pie_p5_confirmation_probe_learner_value.sql 0059_pie_p5_diagnostic_mode_pie_only_attempts.sql 0060_pie_p5_learner_history_rpcs.sql 0061_pie_p5_selector_log_redaction.sql"
apply() { for f in $2; do psql -X -q -v ON_ERROR_STOP=1 -U "$owner" -d "$1" -1 -f "$mig/$f"; echo "applied $f"; done; }

db=v2_p5
"$here/../live_replica/replay.sh" "$db" --with-0044
apply "$db" "$MIGS $P51"
psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/../pie_p1_p2/fixtures.sql"
psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/fixtures_p5.sql"
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/verify_p5.sql"
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/verify_0059.sql"
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/verify_0060.sql"
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/verify_0061.sql"

[[ "${SKIP_BANK:-}" == 1 ]] && exit 0
db=v2_p5_bank
"$here/../live_replica/replay.sh" "$db" --with-0044
apply "$db" "$MIGS"
# a stand-in ZYNTRA-BS row (the live basic-science bank) that 0057 must retire, not delete
psql -X -q -v ON_ERROR_STOP=1 -d "$db" -c "insert into public.questions(id,zyntra_id,subject_id,stem,options,correct_answer,status) values ('33333333-0000-0000-0000-000000000001','ZYNTRA-BS-001','11111111-0000-0000-0000-000000000001','BS stem','[\"a\",\"b\",\"c\",\"d\",\"e\"]','A','active')"
psql -X -q -v ON_ERROR_STOP=1 -d "$db" -c "update public.questions set status='retired' where zyntra_id is null"  # replica placeholders
apply "$db" "0057_pie_p5_qbank_swap.sql $P51"
psql -X -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/../pie_p1_p2/fixtures.sql" 2>/dev/null || psql -X -q -v ON_ERROR_STOP=1 -d "$db" -c "create or replace function public.t_assert(ok boolean, msg text) returns void language plpgsql as \$\$ begin if ok is not true then raise exception 'ASSERTION FAILED: %', msg; end if; end \$\$; grant execute on function public.t_assert(boolean,text) to public;"
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/verify_bank.sql"
psql -X -v ON_ERROR_STOP=1 -d "$db" -f "$here/verify_bank_diag.sql"
"$here/../pie_p3/race.sh" v2_p5  # race tests under the P5 policy too
