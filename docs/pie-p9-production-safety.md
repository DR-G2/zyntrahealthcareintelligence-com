# PIE P9 Production Safety and Data Integrity

## Purpose

P9 hardens the implemented PIE development system before any production shadow deployment.

## Security

- Internal PIE state is not client-writable.
- PIE writes are service-role controlled.
- Admin authorization is case-insensitive.
- PIE inference and admin inspection use an explicit allowed origin instead of wildcard CORS.
- Candidate-facing runtime decisions remain disabled.
- Legacy readiness remains untouched.

## Data integrity

The database rejects:

- negative timing values
- negative answer-change counts
- outcome/final-answer contradictions
- candidate state estimates outside 0..1
- invalid uncertainty bounds
- invalid confidence/evidence ranges
- negative runtime uncertainty

Canonical observation timestamps and candidate state sequences are indexed for deterministic retrieval.

## Safety boundary

P9 does not promote PIE to production.

It does not:

- overwrite legacy readiness
- expose internal candidate state to other candidates
- create causal claims from observational data
- activate interventions
- certify the model

## Next gate

P10 is shadow deployment and production integration. PIE remains non-candidate-facing until the shadow evidence gates are satisfied.
