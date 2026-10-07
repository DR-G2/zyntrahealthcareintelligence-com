# Live-applied V2 migrations (drift capture)

These files are **byte-exact copies** of migrations that were applied directly to the live
V2 Supabase project (`hkowvjazuwebmibssdut`) on **2026-10-06** by `rite4hire@gmail.com`
(Mr. G's own tooling) but were never committed, or were committed in a different form.
Each file is `statements[1]` from `supabase_migrations.schema_migrations`, written without
any added header so `md5(file) == md5(live statement)`.

`LIVE_ORDER.tsv` is the authoritative replay order: all **57** live migrations, in live
`version` order, each mapped to the repo file whose checksum equals the live statement.
`supabase/verification_v2/live_replica/replay.sh` replays it into a throwaway Postgres.
A replica built that way has the same catalog fingerprint as live (function bodies,
SECURITY DEFINER, search_path, EXECUTE grants, views + options + grants, tables + column
grants, RLS, policies, constraints, triggers, indexes), checked read-only on 2026-10-06.

Nothing here is secret: SQL DDL/DCL only.

## What is in this folder and why

Not represented in the repo at all before this capture (13):

| live version | name |
|---|---|
| 20261006070753 | revoke_anon_v2_question_pool |
| 20261006073009 | v2_base_content_column_security |
| 20261006075025 | 0035_authenticated_practice_policies |
| 20261006075120 | 0036_pin_updated_at_search_path |
| 20261006075138 | 0037_enforce_active_practice_questions |
| 20261006075155 | 0038_prevent_practice_explanation_leak |
| 20261006075221 | 0039_prevent_pool_explanation_leak |
| 20261006075247 | 0040_harden_practice_attempt_boundary (save_attempt writes pie.pie_observation) |
| 20261006075314 | 0041_bound_practice_session_size |
| 20261006075415 | 0042_security_invoker_learner_views |
| 20261006075420 | 0043_security_invoker_remaining_views |
| 20261006111902 | public_pie_rebuild_boundary (public.rebuild_candidate_state wrapper) |
| 20261006111928 | expose_pie_rpc_schema (pgrst.db_schemas adds `pie`) |

Applied live in a different text form than the repo file of the same purpose (6). The repo
files are kept; the live text is what actually ran:

| live version | live name | repo counterpart |
|---|---|---|
| 20261006060105 | phase10_practice_session_lifecycle_v2 | 0021_practice_session_lifecycle.sql |
| 20261006060135 | phase10_practice_rpc_privileges | 0022_practice_rpc_privileges.sql |
| 20261006060920 | 0021_secure_practice_results | 0021_secure_practice_results.sql |
| 20261006060927 | 0022_practice_results_correct_answer_after_completion | 0022_practice_results_correct_answer_after_completion.sql |
| 20261006061245 | 0023_revoke_anon_practice_results | 0023_revoke_anon_practice_results.sql |
| 20261006064444 | v2_practice_question_pool | 0024_v2_practice_question_pool.sql |

## Other live facts recorded by the manifest

- `0001`–`0008` were applied twice (054752–054820 and again 054836–054904); both runs are
  idempotent and both are listed.
- `0009_rls` and `0010_integrity_and_updated_at` were applied once (first run only).
- `0019_learner_view_privileges.sql` (repo) was **never applied** to live.
- `v2_intervention_catalog_baseline` and `v2_intervention_catalog_baseline_retry` are the
  same text as repo `0033_intervention_catalog_baseline_retry.sql`.
- Repo-numbered files `0035`–`0043` exist only here; the repo's own next number is `0044`.

## Next repo migration

`../0044_pie_candidate_state_pipeline_repair.sql` is written against the state after
`20261006111928_expose_pie_rpc_schema` and refuses to run if live differs.
