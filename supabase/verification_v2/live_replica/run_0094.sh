#!/usr/bin/env bash
# LOCAL/CI ONLY: validate full-history PIE state and dimension metadata on a disposable DB.
# Never point this script at production.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mig="$here/../../migrations_v2"
db="${1:-v2_verify_0094}"
owner="${OWNER_ROLE:-zyntra_owner}"

"$here/replay.sh" "$db" --with-0044
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0083_pie_subject_session_cap.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0088_pie_candidate_state_full_history.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0094_authoritative_pie_dimension_evidence.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0099_pie_practice_mode_provenance.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0100_behavior_profile_v2_contract.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0101_pie_mode_scoped_evidence.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0102_pie_calibration_paired_evidence.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0103_pie_mode_scoped_latest_observation_at.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -f "$here/verify_0094.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -f "$here/verify_0099.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -f "$here/verify_0100.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -f "$here/verify_0101.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -f "$here/verify_0102.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -f "$here/verify_0103.sql"

# 0104 rollout regression: prove an existing Normal MCQ profile survives the
# candidate-wide constraint migration, then prove both allowed values remain writable.
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" <<'SQL'
insert into auth.users(id, email)
values ('cccccccc-0000-0000-0000-00000000000c', 'verify-0104-legacy@example.invalid')
on conflict (id) do nothing;

insert into intelligence.behavior_profiles(
  user_id, session_mode, evidence_count, archetype, archetype_signals,
  block_performance, subject_patterns, trap_flags, recommendations, model_version
) values (
  'cccccccc-0000-0000-0000-00000000000c', 'normal_mcq', 1, 'unavailable',
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, 'verify-0104'
) on conflict (user_id) do update set session_mode = 'normal_mcq';
SQL

psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -1 -f "$mig/0104_candidate_wide_behavior_profile.sql"
psql -X -v ON_ERROR_STOP=1 -U "$owner" -d "$db" -f "$here/verify_0104.sql"
echo "PASS: full-history estimator, authoritative evidence and candidate-wide Behaviour migration regression"
