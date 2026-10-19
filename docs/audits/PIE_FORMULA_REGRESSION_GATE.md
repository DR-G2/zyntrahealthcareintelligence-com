# PIE formula regression gate

Status: **remediation branch created; CI and isolated producer verification pending**

## Why this gate exists

Source review found calculation mismatches across V2 SQL, legacy SQL, and edge-function calculations. This must be resolved against the deployed schema and data contract before modifying shared metrics.

## Required invariants

1. Missing response times are excluded from rush and timing denominators.
2. No valid confidence observations means calibration is unavailable, not a neutral score.
3. A timing change is a timing observation, not proof of fatigue.
4. Trust Your Gut uses only changed attempts with a valid first choice and a valid answer key in its denominator.
5. Readiness must not fall through to an EXAM_READY band when a component is missing.
6. Per-dimension evidence sufficiency is checked separately from global observation count.
7. V2, legacy SQL, and edge functions either share a versioned canonical formula or expose distinct metric names.

## Deployed V2 producer smoke test

Executed against the existing Supabase project in one SQL transaction using a generated disposable auth identity, ten fixture attempts against existing question IDs, and `intelligence.rebuild_candidate(uuid)`. The transaction was rolled back. A subsequent read-only check confirmed zero remaining fixture users, zero fixture attempts, and zero matching recent fixture output rows.

Observed output:

| Fixture | Calibration | Rush | Hesitation | Fatigue | Readiness |
|---|---:|---:|---:|---:|---|
| 10 correct attempts, time missing, confidence missing | 0.5 | 0.5 | 0.5 | 0 | 82.5 / STRONG |
| Same 10 attempts, response time set to 1 second, confidence still missing | 0.5 | 0.0187 | 0.9813 | 0 | 89.72 / EXAM_READY |

Assertions passed for the current observed outputs. This is a smoke test of the deployed V2 producer, not a comprehensive test suite.

### Defects reproduced

- **Missing confidence treated as evidence:** calibration remains 0.5 with zero valid confidence observations.
- **Readiness gate failure:** ten perfect attempts with missing confidence and 1-second timing produce `EXAM_READY` (89.72), despite confidence calibration being unavailable.
- **Rush/hesitation semantics:** the same timing score is assigned as rush = 1 − timing and hesitation = timing. With 1-second attempts, this produces rush 0.0187 and hesitation 0.9813, which appears inverted for intuitive labels.
- **Fatigue proxy:** fatigue is 1 − answer stability. This fixture produces 0 because answers never changed; the metric does not measure fatigue.

The smoke test did **not** validate legacy SQL producers or the Trust Your Gut edge-function denominator. Those remain untested against a disposable isolated fixture.

## Test file

`supabase/verification_v2/pie_formula_regression_contract.sql` is a fixture-only semantic contract. It is not a substitute for tests of the actual producer functions.

## PIE state-model v2.2 fixture test

The proposed `0082_pie_distinct_metric_rewrite.sql` was executed inside a transaction using one disposable auth identity, 12 synthetic attempts, and one duplicate observation. Assertions passed for attempt deduplication, distinct dimension outputs, confidence remaining unavailable below 10 valid ratings, learning/sustained metrics at the configured sample size, and null model confidence. The transaction was rolled back; read-only cleanup verification found zero fixture users, attempts, states, or inference runs. This does not replace the remaining CI and consumer checks.

## Merge gate

Do not merge a production formula change until:
- tests cover the deployed V2 producer with missing-data and boundary scenarios;
- legacy edge-function and SQL paths are compared or retired;
- per-dimension evidence sufficiency and readiness gating are tested;
- all existing PIE tests, typecheck, and build pass;
- candidate-facing labels and denominator definitions are updated in the same change.

No persistent candidate records or schema were modified by the smoke test. The separate existing finding that `public.question_retirement_backup_20261014` has RLS disabled remains unresolved and should be reviewed independently.


## Remediation branch: `fix/pie-metric-semantics`

Implemented in source, pending CI and database migration verification:

- Added V2 migration `0081_pie_metric_semantics.sql` to exclude missing timing from timing denominators, use explicitly named rapid-incorrect and slow-response observations, stop deriving fatigue from answer instability, and require same-session accuracy decline + timing increase + change-rate increase before emitting a fatigue signal.
- Confidence alignment is unavailable until at least 10 valid confidence observations; missing confidence is no longer assigned 0.5. It is explicitly named confidence alignment in JSON, not presented as a validated calibration model.
- Removed the unvalidated composite readiness calculation. The score now represents observed accuracy only after 30 attempts, with no `EXAM_READY` output. It is explicitly not an AMC pass probability. Fewer attempts return `INSUFFICIENT`.
- Edge-function analysis now excludes missing timing from averages, orders the selected session chronologically, gates fatigue on same-session multi-signal deterioration, and excludes invalid first-choice/key pairs from Trust Your Gut denominators.
- PIE state mapping now requires per-dimension evidence counts and estimates, not only a global evidence count.
- Confidence presentation now requires an explicit `confidence_alignment` value and at least 10 observations in the evidence window; legacy `calibration_score` alone is not presented as validated calibration.
- Removed AI-generated AMC score-range estimates from the behavior-analysis prompt and fallback. Those estimates were not validated against outcomes.

### Important remaining work

- This branch has not yet passed CI or a local PostgreSQL migration run.
- Legacy `public.rebuild_behavior_dna` and other old producers need a deployed-schema inventory before replacing them; source migrations alone do not prove those functions exist in production.
- Existing candidate rows have not been rewritten. New semantics take effect only after the migration is applied and the producer is run for a candidate.
- The label `confidence_miscalibration` in the legacy schema remains semantically misleading and needs a coordinated schema/API/UI migration if that producer is found deployed.
- `public.question_retirement_backup_20261014` RLS-disabled finding remains independent and unresolved.
