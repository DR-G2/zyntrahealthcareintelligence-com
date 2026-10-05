# PIE Synthetic Validation Lab

## Purpose

This lab is the executable safety gate for the Performance Intelligence Engine (PIE).

It is separate from production candidate data. Synthetic truth is generated independently from observations, so the lab can measure whether a model recovers known hidden states.

## Current phase: P2.1

Implemented:

- deterministic seeded synthetic universe
- hidden candidate states
- question/task parameters
- outcome, confidence, decision and timing observations
- controlled missingness
- explicit uncertainty representation
- development-only candidate estimator
- first five executable validation tests
- catalog of the full 20-test validation program

## Important boundary

The development estimator is **not** the final PIE mathematical model.

It is intentionally simple and inspectable. Its purpose is to give the validation lab a real model to challenge before we introduce a more complex hierarchical dynamic state-space implementation.

No production readiness score is calculated here.

## 20-test program

1. Capability recovery
2. Timing separation
3. Decision separation
4. Calibration recovery
5. Change-point recovery
6. Interruption recovery
7. Learning recovery
8. Question difficulty recovery
9. Bad-question protection
10. Missing-data robustness
11. Technical contamination
12. Equal-score separation
13. False-separation resistance
14. Uncertainty convergence
15. False-certainty resistance
16. Prior sensitivity
17. Exam neutrality
18. Decision validity
19. Causal validity
20. Reproducibility and stability

The repository catalog preserves the original 001-020 numbering used by the PIE research plan. The executable implementation will be expanded in subsequent phases. We do not mark unimplemented tests as passed.

## Acceptance rule

A test is only PASS when its executable experiment demonstrates the stated property. A schema, fixture, or expected value is not validation.

No composite winner score is used. Models are compared using measurement error, calibration, decision error, uncertainty behaviour, robustness and complexity burden.

## Scientific safety rules

- Prior != observation != validated parameter.
- No estimate without uncertainty.
- No conclusion without evidence.
- No intervention without a measurable outcome.
- Question defects must not masquerade as candidate defects.
- Missing data must not create false certainty.
- Exam adapters must not silently rewrite the core candidate state.
- Causal claims require an independent causal design.

## Running

`npm run test -- src/lib/pie/validation/synthetic-lab.test.ts`

The current tests are deterministic and use fixed seeds. Test thresholds are engineering guardrails for the synthetic fixtures, not clinical or exam-performance claims.
