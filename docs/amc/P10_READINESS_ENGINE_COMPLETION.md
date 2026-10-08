# P10 AMC Readiness Engine

Status: **LIVE / ENGINEERING-COMPLETE / VALIDATION-GATED**

## Current AMC source contract

The adapter is versioned independently from PIE and currently references:
- AMC MCQ Examination Specifications V8
- AMC Clinical Examination page
- AMC Assessment Domains

Current environment definitions:
- MCQ: 150 questions, 3.5 hours, CAT, five options, one correct response.
- Clinical: 16 assessed stations + 4 rest stations, 10 minutes per station with 2 minutes reading and 8 minutes assessment.

## Readiness architecture

PIE v2 inference remains exam-neutral.

AMC adapter consumes:
- capability
- decision
- timing
- calibration
- sustained performance
- learning

The adapter produces an **AMC-conditioned engineering readiness index** with uncertainty and evidence metadata.

It deliberately does **not** expose a pass probability until an independently calibrated AMC validation model is available.

## Live contract

- `amc-readiness-v1.0`
- `AMC 1.0.0`
- MCQ environment: `AMC_CAT_MCQ / 2026.1`
- Clinical environment: `AMC_CLINICAL / 2026.1`
- Plugin status: `VALIDATING`
- Environment status: `VALIDATING`
- pass-probability calibration: **false**

Candidate-facing path:
`amc-intelligence` -> scoped `rebuild_my_amc_readiness()` -> allow-listed readiness DTO.

Raw AMC tables remain inaccessible to anonymous/authenticated direct SELECT.

## Why validation remains gated

A readiness index is useful for training control but is not evidence that a candidate will pass the AMC examination.

The AMC describes its MCQ exam as CAT and uses a pass standard based on the exam's calibrated measurement system. Zyntra does not possess AMC's proprietary scoring/calibration data.

Therefore:
- no fabricated pass probability;
- no claim of AMC score equivalence;
- no claim of validated pass prediction;
- no intervention efficacy claim.

## Remaining scientific gate

To promote P10 from validation-gated to scientifically certified:
1. approved anonymised response dataset;
2. independent item calibration/cross-check;
3. empirical Zyntra validation;
4. pre-specified calibration and discrimination metrics;
5. independent holdout validation;
6. documented promotion decision;
7. only then activate a calibrated probability model.

Until those gates are met, P10 is correctly **LIVE but validation-gated**, not falsely labelled as a validated AMC pass predictor.
