# PIE P11 Certification and Controlled Promotion

P11 defines the final certification gate. It does not certify the current development model automatically.

## Certification levels

```
Level 0  Sanity
   ↓
Level 1  Measurement
   ↓
Level 2  Decision
   ↓
Level 3  Intervention
```

Promotion requires an explicit persisted certification record.

## Blocking conditions

Promotion remains blocked when there is:

- high-confidence wrong state estimation
- false change-point or sustained-performance detection
- defective-question contamination
- false certainty under missing data
- exam-adapter corruption
- unacceptable DWIG regret
- unsupported causal claims
- poor reproducibility
- candidate-facing leakage
- legacy-path regression

## Production rule

Even after a certification record exists, promotion is not automatic.

Legacy readiness remains authoritative until an explicit controlled promotion decision is made.

## Required evidence

Certification must reference:

- model versions
- validation run
- measurement results
- decision validity
- question protection evidence
- shadow stability
- security/data-integrity evidence
- intervention/causal evidence only for Level 3

No single composite score decides certification.
