# PIE P3: State Inference Engine

P3 converts canonical observations into an exam-neutral dynamic candidate state.

## State

The engine maintains six dimensions:

- Capability
- Decision
- Timing
- Calibration
- Sustained performance
- Learning

Each dimension is represented as:

**estimate + variance + interval + evidence + evidence quality**

There is no single PIE readiness score.

## Update model

P3 uses a recursive state-space style update.

Conceptually:

Z(t+1) = F(Z(t), observation) + process noise

The implementation uses a bounded scalar posterior update for each dimension. The measurement contribution is reduced when the observation is suspicious, contradictory, unusable, or technically interrupted.

This is an executable development model, not yet the certified final hierarchical dynamic psychometric model.

## Capability

Capability evidence is conditioned on observed question difficulty and discrimination.

The engine does not simply count correct answers.

## Decision

Decision state uses first-answer versus final-answer behaviour when both are observed.

## Timing

Timing evidence is derived from observed timing/pressure data.

## Calibration

Calibration requires candidate confidence. Missing confidence is missing evidence, not a calibration failure.

## Sustained performance

The state uses observed performance as one signal and is intended to be interpreted through temporal residuals and dynamics. It is not labelled as a direct fatigue diagnosis.

## Learning

Learning evidence requires explicit learning context. Improvement alone is not treated as proof of learning.

## Dynamics

P3 derives:

- stability
- recovery
- elasticity
- inertia
- velocity
- change-point probability
- sustained-performance decline estimate

These are descriptive state dynamics. They are not causal claims.

## Identifiability

P3 keeps competing explanations explicit. A state can remain UNRESOLVED when evidence cannot separate explanations.

## Uncertainty

Uncertainty is first-class. No dimension is considered complete without uncertainty.

## Exam neutrality

P3 produces only the candidate state. Exam readiness remains downstream in the exam adapter.

## Safety

The engine must not infer:

- distraction from tab hiding
- external application identity
- psychological traits
- medical conditions
- exam-pass probability from the core state alone

## Next stage

P4 should build question intelligence and joint candidate-question inference with anti-circularity and question protection.
