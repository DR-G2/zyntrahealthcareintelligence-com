# AMC Plugin v1 P7-P8 Validation and Certification

## P7: External validation

P7 separates source validation, psychometric cross-checking, synthetic truth recovery, integration testing, and security testing.

### External AMC specification validation

The authoritative source is the Australian Medical Council examination specification.

The validator checks:
- MCQ structure
- MCQ timing
- MCQ blueprint
- Clinical structure
- Clinical assessment areas
- version/provenance consistency

A source check does not prove that the PIE model is scientifically correct. It proves that the AMC adapter matches the selected official specification.

### Independent psychometric cross-check

PACER is an external browser-based psychometric platform supporting 1PL, 2PL, 3PL, IRT calibration, scoring, item analysis, DIF, equating and related methods.

Zyntra can export an approved/anonymised response dataset and compare suitable conventional item parameters against an independent implementation.

This is a cross-check only.

It does not validate the complete hierarchical dynamic state-space PIE model because that model is intentionally broader than classical IRT.

### Synthetic truth recovery

The synthetic laboratory remains the primary controlled test environment for latent-state recovery.

P7 should test:
- capability recovery
- timing separation
- decision separation
- calibration recovery
- sustained-performance recovery
- change-point recovery
- interruption recovery
- learning recovery
- question difficulty recovery
- defective-question protection
- missing-data robustness
- exam neutrality
- uncertainty calibration

Truth is generated independently from observations.

### Security validation

P7 verifies the information boundary:
- candidate cannot directly read AMC internal tables
- candidate cannot directly read PIE internal tables
- service role is required for internal AMC operations
- candidate API responses are allow-listed
- cross-user IDs are rejected
- raw posterior/state/hypothesis/DWIG/causal data are not returned

## P8: Certification

P8 converts validation evidence into a formal gate.

### Gate 0: Source and security

Required:
- AMC source validation
- blueprint validation
- security validation

### Gate 1: Measurement

Required:
- external psychometric cross-check
- synthetic truth recovery
- integration validation

### Gate 2: Decision

Required:
- all Gate 0 and Gate 1 evidence
- decision validity
- stable uncertainty
- no critical security failure
- no unresolved specification mismatch

Gate 2 is the minimum level that can permit plugin promotion.

### Gate 3: Intervention

Required before AMC interventions can be represented as validated effectiveness claims:
- Gate 2
- outcome evidence
- causal/intervention validation
- reproducible effect estimates

No gate automatically becomes PASSED.

## Certification rule

```
Evidence
   |
   v
Validation run
   |
   v
Metrics + limitations
   |
   v
Certification gate
   |
   +--> PASSED
   +--> FAILED
   +--> BLOCKED
   +--> REVOKED
```

A failed or inconclusive external test cannot be hidden by a passing internal test.

## Current state

AMC Plugin v1 remains:

`DEVELOPMENT`

It is not certified and must not be presented to candidates as a scientifically validated readiness engine.

