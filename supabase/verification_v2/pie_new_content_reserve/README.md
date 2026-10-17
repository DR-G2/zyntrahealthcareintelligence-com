# 0084 PIE new-content reservation: verification

- `live_decide_20261014_post0083.sql`: live `pie.decide` captured 2026-10-14 after Gus applied 0083 (body identical to 0083). Rollback = re-apply this file.
- `run.sh`: throwaway local Postgres. Runs the 0083 subject-cap suite (T1–T10) with 0084 applied, then `tests.sql` (R1–R7).
- `../pie_subject_cap/tests.sql_helpers.sql`: seed/build/assert helpers shared with the cap suite.
