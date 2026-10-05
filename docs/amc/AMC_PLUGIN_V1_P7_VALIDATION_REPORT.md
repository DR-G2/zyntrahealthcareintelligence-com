# AMC Plugin v1 P7 Validation Report

Date: 2026-10-05

Validation harness revision: P7-runtime-1
Branch: `amc/plugin-v1-p0-p6`
PR: #50
Status: DEVELOPMENT

## Evidence executed

### 1. Official AMC specification
Status: PASS for source-contract checks.

Verified against the current AMC examination specification:
- MCQ: 150 questions
- duration: 3.5 hours
- CAT delivery
- five response options with one correct response
- blueprint proportions: 30%, 20%, 12.5%, 12.5%, 12.5%, 12.5%

The implementation stores the proportions as the source values. It does not create six independently rounded item counts because those rounded values sum to 151.

### 2. Clinical environment
Status: PASS for source-contract checks.

The plugin stores:
- 16 assessed stations
- 4 rest stations
- 10 minutes per station
- 2 minutes reading
- 8 minutes assessment
- history
- examination
- diagnostic formulation
- management/counselling/education

### 3. AMC response-matrix simulation
Status: IMPLEMENTED.

The P7 harness now includes a deterministic AMC CAT response-matrix simulator. It generates candidate truth, an item pool with calibrated and new items, 150-item candidate-specific adaptive examinations, confidence, timing and answer-change observations, and a sparse candidate × question response matrix. The simulator follows the public AMC structural constraints but is explicitly not presented as the proprietary AMC CAT selection/scoring algorithm. The current AMC specification states that at least half of the questions come from previously calibrated questions and that new questions are inspected and calibrated before scoring. citeturn0search12

### 4. Synthetic truth recovery
Status: PASS at engineering-test level.

The P7 runtime test uses an independently generated synthetic truth and checks capability recovery, uncertainty behaviour and confidence/outcome separation.

Independent local replication across five seeds produced Spearman correlations between true capability and observed performance of approximately 0.770 to 0.853.

These are engineering validation results, not clinical or population validity claims.

### 5. Confidence calibration boundary
Status: PASS at contract/test level.

Confidence is retained as an observation separate from correctness. The test records Brier score as a calibration diagnostic rather than treating accuracy as confidence calibration.

### 6. Security boundary
Status: PASS at code-contract level.

The candidate DTO exposes only:
- plugin
- plugin version
- exam mode
- environment
- readiness summary
- evidence summary
- optional next action

Raw state, question posterior, hypotheses, DWIG internals, causal evidence, intervention effects and certification state are excluded.

### 7. Independent psychometric cross-check
Status: INCONCLUSIVE / NOT EXECUTED.

PACER supports independent 1PL/2PL/3PL calibration and related psychometric analysis. A PACER run requires an approved response dataset. No live AMC attempt dataset was available through the current database connector, so no external PACER result is claimed.

### 8. Empirical Zyntra AMC attempt validation
Status: BLOCKED.

The available database backup contains the legacy `user_attempts` table but does not contain AMC plugin validation tables or a usable anonymised AMC response matrix. Direct live Supabase SQL permission was also unavailable in this environment.

No empirical candidate-level claim is therefore made.

## P8 status

### Gate 0
AMC source + blueprint + security:
**PROPOSED / engineering evidence present**

### Gate 1
Measurement:
**BLOCKED** until independent psychometric evidence and empirical/synthetic validation evidence are formally recorded.

### Gate 2
Decision:
**BLOCKED**

### Gate 3
Intervention:
**BLOCKED**

## Important conclusion

The plugin has passed its current source-contract, engineering and security checks.

It has NOT been certified as a scientifically validated AMC readiness system.

The remaining blocker is evidence, not application architecture:
1. export an approved anonymised AMC response matrix;
2. independently calibrate suitable items using PACER or another independent psychometric implementation;
3. record the independent results;
4. run the empirical Zyntra validation;
5. only then evaluate Gate 1 and Gate 2.

No certification status has been auto-promoted.
