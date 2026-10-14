# PIE per-session subject cap (0083): tests

- `live_baseline_20261014.sql`: live definitions of `pie.decide`, `pie.rank_candidates`, `public.pie_create_session`, `public.pie_next_question`, captured read-only from V2 on 2026-10-14 (with live ACLs). Reference only.
- `live_decide.sql`, `live_rank_candidates.sql`, `live_pie_create_session.sql`, `live_pie_next_question.sql`: live bodies used by the harness. `live_decide.sql` and `live_pie_create_session.sql` are also the rollback.
- `schema_stub.sql`: minimal replica of the tables the selector touches (columns copied from live) plus the live `pie-select/p3.0` weights.
- `tests.sql`: T1 to T7 (cap at 8 of 20; live baseline uncapped for comparison; single-subject fallback; exhausted second subject; `target_length` from session config; default 20; open-ended scaling; grants and definer; determinism), T8 (`pie_create_session` persists `target_length`; extended session keeps the cap), T9 (fallback prefers least-represented capped subject, then score), T10 (`pie_create_session` definer, search_path, ACL).
- `run.sh`: starts a throwaway PostgreSQL cluster, loads the stub, the live `rank_candidates`, then 0083, and runs the tests.

```
supabase/verification_v2/pie_subject_cap/run.sh
```
