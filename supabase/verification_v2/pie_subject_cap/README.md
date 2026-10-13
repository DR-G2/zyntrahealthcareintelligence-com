# PIE per-session subject cap (0082): tests

- `live_baseline_20261014.sql`: live definitions of `pie.decide`, `pie.rank_candidates`, `public.pie_create_session`, `public.pie_next_question`, captured read-only from V2 on 2026-10-14 (with live ACLs). Reference only.
- `live_decide.sql`, `live_rank_candidates.sql`: the two live selector bodies used by the harness.
- `schema_stub.sql`: minimal replica of the tables the selector touches (columns copied from live) plus the live `pie-select/p3.0` weights.
- `tests.sql`: T1 to T7 (cap at 8 of 20; live baseline uncapped for comparison; single-subject fallback; exhausted second subject; `target_length` from session config; default 20; open-ended scaling; grants and definer; determinism).
- `run.sh`: starts a throwaway PostgreSQL cluster, loads the stub, the live `rank_candidates`, then 0082, and runs the tests.

```
supabase/verification_v2/pie_subject_cap/run.sh
```
