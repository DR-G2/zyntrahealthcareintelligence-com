# PIE P8 Full-System Validation

## Purpose

P8 validates the implemented PIE layers as one development system.

P8 is an integration gate. It is not scientific certification.

Flow:

`observation -> candidate state -> question state -> question protection -> DWIG -> runtime decision -> intervention eligibility -> outcome/evidence -> state update`

## Gates

1. Candidate state remains six-dimensional.
2. Candidate state contains uncertainty.
3. Question protection blocks weak or candidate-contaminated questions.
4. DWIG selects only eligible questions.
5. Runtime preserves uncertainty.
6. Runtime decisions are not candidate-facing.
7. Certified mode cannot promote a protected question.
8. Interventions without validated evidence are not selected.
9. No composite readiness score is introduced.

## What P8 does not prove

P8 does not prove:

- final model accuracy
- clinical validity
- exam pass prediction
- causal intervention effectiveness
- production readiness
- certification of any mathematical parameter

Those require P8/P9 validation evidence, controlled data, and later certification gates.

## Acceptance rule

All integration gates must pass.

A failure blocks the phase. No automatic promotion is allowed.

## Current status

Implemented as a deterministic development integration harness.

The production legacy readiness path remains unchanged.
