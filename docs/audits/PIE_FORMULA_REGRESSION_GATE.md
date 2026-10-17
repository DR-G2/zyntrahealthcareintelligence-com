# PIE formula regression gate

Status: **contract drafted; production verification pending**.

## Why this gate exists

Source review found several calculation mismatches across V2 SQL, legacy SQL, and edge-function calculations. This must be resolved against the deployed schema and data contract before modifying shared metrics.

## Required invariants

1. Missing response times are excluded from rush and timing denominators.
2. No valid confidence observations means calibration is unavailable, not a neutral score.
3. A timing change is a timing observation, not proof of fatigue.
4. Trust Your Gut uses only changed attempts with a valid first choice and a valid answer key in its denominator.
5. Readiness must not fall through to an EXAM_READY band when a component is missing.
6. Per-dimension evidence sufficiency is checked separately from global observation count.
7. V2, legacy SQL, and edge functions either share a versioned canonical formula or expose distinct metric names.

## Test file

Run `supabase/verification_v2/pie_formula_regression_contract.sql` against an isolated PostgreSQL database with `psql -v ON_ERROR_STOP=1`.

The SQL uses local fixtures only and does not touch candidate tables. It is a semantic contract, not a substitute for running `rebuild_candidate`, `rebuild_behavior_dna`, or `rebuild_readiness_subject_dna` in an isolated copy of the schema.

## Merge gate

Do not merge a production formula change until:
- the isolated V2 schema is provisioned from migrations;
- regression tests exercise the actual producer functions using disposable users/attempts;
- the legacy edge-function and SQL paths are compared or retired;
- all existing PIE tests and typecheck pass;
- candidate-facing labels and denominator definitions are updated in the same change.

No production data or schema was modified by this contract.
