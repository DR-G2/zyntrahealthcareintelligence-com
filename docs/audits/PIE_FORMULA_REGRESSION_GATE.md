# PIE formula regression gate

Status: **deployed V2 producer smoke test executed; formula defects reproduced; remediation pending**.

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

## Merge gate

Do not merge a production formula change until:
- tests cover the deployed V2 producer with missing-data and boundary scenarios;
- legacy edge-function and SQL paths are compared or retired;
- per-dimension evidence sufficiency and readiness gating are tested;
- all existing PIE tests, typecheck, and build pass;
- candidate-facing labels and denominator definitions are updated in the same change.

No persistent candidate records or schema were modified by the smoke test. The separate existing finding that `public.question_retirement_backup_20261014` has RLS disabled remains unresolved and should be reviewed independently.
