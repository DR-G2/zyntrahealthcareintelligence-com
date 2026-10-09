# P10 Scientific Validation Gate

Status: **IMPLEMENTED / BLOCKED FROM PROMOTION UNTIL EVIDENCE EXISTS**

The gate now exists in code and database. It is deliberately fail-closed.

## 1. Independent response-matrix calibration

Implemented:
- independent Rasch/1PL calibration implementation in `src/lib/amc/psychometric-validation.ts`;
- calibration is separate from the CAT response simulator;
- item difficulty and candidate ability are estimated from observed responses;
- holdout candidate ability is re-estimated using training-calibrated item parameters.

This is an independent engineering implementation. It is **not** AMC's proprietary scoring implementation.

## 2. Empirical / holdout validation

Implemented:
- candidate-level train/holdout separation;
- holdout theta estimation using frozen training item parameters;
- synthetic validation test fixture;
- validation-run database record with dataset approval state.

The current repository contains no approved real AMC candidate response dataset. Therefore no real-world empirical validation claim is made.

## 3. Calibration / discrimination testing

Implemented metrics:
- Spearman rank recovery;
- Brier score;
- ROC AUC;
- expected calibration error (ECE);
- log loss.

These are validation metrics, not AMC pass-standard equivalence.

## 4. Pre-specified promotion criteria

The current engineering gate requires:

| Criterion | Threshold |
|---|---:|
| Candidate count | >= 1,000 |
| Holdout count | >= 200 |
| Spearman | >= 0.75 |
| Brier | <= 0.18 |
| AUC | >= 0.75 |
| ECE | <= 0.05 |
| Log loss | <= 0.60 |
| Dataset approved | required |
| Independent calibration | required |
| Holdout completed | required |
| External review completed | required |

These are **pre-specified engineering promotion thresholds**, not claims that they are AMC regulatory or psychometric standards.

## 5. Fail-closed model activation

`public.amc_promote_calibrated_model()` cannot activate a calibrated pass-probability model unless every gate is satisfied.

Promotion performs all of the following atomically:
1. retires an existing active AMC model;
2. activates the validated model registry record;
3. marks the plugin ACTIVE;
4. marks the exam environment's pass probability calibration flag true;
5. marks the validation run PROMOTED.

Until then:
- AMC plugin remains `VALIDATING`;
- probability status remains `NOT_CALIBRATED`;
- readiness index remains engineering-only;
- no candidate is shown a fabricated pass probability.

## Current evidence state

The synthetic holdout harness is passing at engineering-test level.

The live database promotion gate was also tested with an intentionally incomplete validation run and correctly remained **BLOCKED**.

The remaining blocker is not missing architecture. It is the absence of an approved real AMC response dataset and independent external review. No synthetic result is being promoted as empirical AMC evidence.
