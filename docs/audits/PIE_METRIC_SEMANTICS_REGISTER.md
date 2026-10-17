# PIE Metric Semantics Register

Phase 2 working contract. This document defines what the product may claim before formula remediation. Thresholds marked provisional are engineering gates, not clinically or psychometrically validated cutoffs.

## Canonical metric register

| Metric | Observed quantity | Denominator / eligibility | Missing-data rule | Permitted interpretation | Must not claim |
|---|---|---|---|---|---|
| Clinical accuracy | Correct eligible answered attempts / all eligible answered attempts | Attempt-level; deduplicate attempt IDs; only completed/graded attempts | No eligible attempts = unavailable, not 0% | Observed accuracy for the declared sample/window | Future AMC pass probability |
| Answer-change rate | Attempts with one or more answer changes / eligible attempts | All eligible attempts with reliable change telemetry; expose telemetry coverage | Unknown change telemetry is excluded, not assumed unchanged | How often a candidate changed an answer | Stability, indecision, or correctness by itself |
| Answer stability | Complement of answer-change rate, only if change telemetry is complete and binary per attempt | Same eligible denominator as answer-change rate | Unavailable if telemetry coverage is inadequate; never equate missing changes with zero changes | Observed answer stability | Confidence or clinical competence |
| Mean response time | Mean of valid non-negative response durations | Timed eligible attempts only; report timed count and coverage | No valid durations = unavailable | Descriptive response duration for the window | Timing skill without difficulty/context adjustment |
| Rapid incorrect rate | Incorrect attempts among valid timed attempts completed within a defined rapid threshold | Timed eligible attempts; show rapid threshold and denominator | Missing time excluded | Rapid-response error pattern | General rushing tendency or personality |
| Slow-response rate | Timed eligible attempts meeting an explicit slow threshold / valid timed attempts | Timed eligible attempts; show threshold and denominator | Missing time excluded | Frequency of slow responses in this sample | Hesitation as a stable trait |
| Confidence alignment | Descriptive agreement between recorded confidence and correctness | Valid confidence ratings only; publish scale mapping and count | Below minimum valid confidence observations = unavailable | Confidence/outcome alignment in the sample | Formal calibration unless validated with proper calibration metrics and enough data |
| Over/underconfidence | Separate direction-specific confidence error summaries | Valid confidence ratings only; denominator must be stated | Unavailable without valid confidence | Direction of observed confidence error | Trait-level overconfidence from sparse data |
| Fatigue signal | Within-session late-vs-early deterioration in accuracy, response time and decision behaviour | One chronological session; minimum observations in both halves; timed coverage in both halves; preferably adjust for question difficulty | Unavailable unless all required signals and coverage exist | Candidate-session deterioration pattern consistent with fatigue | Diagnosing fatigue, or inferring it from answer changes or time alone |
| Subject accuracy | Correct eligible attempts / eligible attempts for that subject | Per subject, deduplicated; report subject sample count | Insufficient evidence below threshold; do not rank tiny samples as robust weaknesses | Observed performance for that subject/sample | Durable weakness without repeat evidence |
| Readiness index | No composite canonical metric approved yet | Any future composite requires predeclared versioned formula, complete components, uncertainty and outcome validation | Missing required component => unavailable | Only the exact measured index after validation | AMC readiness or pass probability before external outcome validation |
| Dimension estimate | Estimate for one explicitly named latent/observed construct | Per-dimension evidence count and quality; model version and window | Missing estimate/count/uncertainty => unavailable | Estimate conditional on stated model and evidence | Treating repeated copies of accuracy as independent dimensions |
| Uncertainty / interval | Empirically evaluated uncertainty around a stated estimand | Requires a defined estimator, coverage evaluation and independent validation set | If not calibrated, label heuristic/experimental or do not show as interval | Only the validated uncertainty claim | Statistical confidence interval based only on evidence-count heuristics |
| Next-best action | Recommendation chosen from observed candidate evidence and an intervention policy | Eligible subject evidence, policy version, traceable rationale | No adequate evidence => generic safe action or unavailable | Suggested practice action with rationale | Proven benefit until intervention outcomes show measurable improvement |
| Learning gain / intervention effect | Change in a predeclared outcome after intervention relative to a credible comparison/baseline | Paired attempts or suitable evaluation design, time window and confounder control | Missing pre/post or comparison data = unavailable | Observed change; causal effect only if design supports it | Claiming an intervention works from a single before/after score |

## Rules for formula implementation

1. Every stored metric must include or be traceable to a formula version, numerator, denominator, evidence count, observation window, and missing-data policy.
2. Use separate names for raw observations and inferred constructs. answer_change_rate is observed; fatigue_signal is inferred.
3. A threshold (e.g. 10 confidence observations or 30 attempts) is a minimum operational gate, not proof of psychometric validity.
4. Do not use generic neutral imputation to make a metric appear available. Null/insufficient/unavailable must survive SQL, API, and UI.
5. Do not calculate a readiness composite while required components are absent. Any candidate-facing score must say exactly what it measures.
6. Use the same eligible attempt set when comparing accuracy, changes and time in a within-session fatigue assessment; otherwise missing telemetry can create artificial deterioration.
7. Stratify or adjust timing/fatigue analyses for question difficulty and item mix before treating differences as candidate behaviour.
8. Subject ranking and next-best-action selection must enforce per-subject evidence thresholds and avoid stable recommendations from tiny denominators.
9. Distinguish statistical validity, engineering correctness, and product copy approval. Passing tests establishes only the tested properties.
10. Formula changes must be tested at boundaries: zero observations; one observation; just below/at/above each threshold; null timing/confidence/change telemetry; all-correct/all-incorrect; duplicate attempts; mixed sessions; unequal session lengths; invalid answer keys; and difficulty-mixed halves.

## Current implementation comparison

### intelligence.rebuild_candidate(uuid) remediation in PR #155
- Improvements: missing confidence becomes null after a minimum count; timing is excluded from the proposed readiness index; score is observed accuracy after 30 attempts; no EXAM_READY band; timing missingness is excluded from time means; fatigue requires multi-signal within-session deterioration.
- Still requires correction/verification: the database field remains named readiness_score and existing UI consumers may still present it as readiness although it is observed accuracy only; difficulty adjustment is not implemented; rush/hesitation column names can still be mistaken for psychological traits; subject/action thresholds are not enforced. Fatigue now gates on change-rate increase, but the heuristic remains unvalidated and is not difficulty-adjusted.
- SQL migration has not been persistently applied.

### pie.rebuild_candidate_state(uuid) currently deployed
- Still uses neutral fallbacks for confidence, timing, and answer-change estimates when data is missing.
- Capability, sustained performance and learning all use the same overall accuracy estimate, so they are not independent dimensions.
- Calibration is derived from the absolute difference between aggregate confidence and aggregate accuracy; this can hide individual-level miscalibration and is not a formal calibration evaluation.
- Uncertainty is driven by observation count (capped at 100), not validated empirical coverage.
- This is a distinct authoritative state path and is not corrected by PR #155's intelligence.rebuild_candidate migration.

### public.rebuild_my_amc_readiness(text)
- The function returns null pass probability and marks it NOT_CALIBRATED, which is the correct conservative product boundary.
- The engineering readiness index and bounds still require separate audit; the current interval logic based on mean dimension estimate ± uncertainty is not a calibrated predictive interval.

## Phase 2 exit criteria
- Every metric has one approved definition and denominator.
- Production and source producers are mapped to those definitions.
- Tests exercise the actual producer functions, not just a duplicate formula in a fixture.
- Known conflicts have a proposed migration plan and backward-compatibility strategy.
- No formula is labelled verified solely because CI passed.


### PIE state-model rewrite v2.2 (PR #155, source-only)
The new migration `0082_pie_distinct_metric_rewrite.sql` rewrites the separate `pie.rebuild_candidate_state(uuid)` producer rather than removing the six dimensions:
- **Capability:** observed accuracy from graded, deduplicated attempts.
- **Decision:** share of attempts with known change telemetry that did not change the answer. This is decision stability, not decision quality.
- **Timing:** a descriptive response-pace index plus mean seconds and timed count. The 30-second transform anchor is provisional and must not be interpreted as skill or used in a readiness composite.
- **Calibration:** mean per-attempt agreement between recorded normalized confidence and correctness, only with at least 10 valid observations. It is descriptive alignment, not a validated calibration curve.
- **Sustained performance:** consistency across chronological accuracy blocks, available only when at least three blocks exist.
- **Learning:** chronological accuracy slope across blocks, available only with at least 12 graded attempts. This is association over time, not causal proof that an intervention worked.
- Each dimension carries its own evidence count and definition. Missing estimates stay null. The state confidence field is null because evidence count alone is not a calibrated uncertainty estimate.
- Duplicate observation events are deduplicated by attempt ID before aggregation.

The migration was executed against the live database inside a transaction with a disposable auth user, 12 synthetic attempts, and a duplicate observation. Assertions passed for deduplication, per-dimension availability, missing-confidence behavior, learning/sustained metrics, and null model confidence. The transaction was rolled back; a follow-up read-only query confirmed zero fixture users, attempts, states, or inference runs remain. This migration has **not** been persistently applied. Full CI and UI consumer validation are still required before release.
