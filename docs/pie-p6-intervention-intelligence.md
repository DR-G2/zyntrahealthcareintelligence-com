# PIE P6: Intervention Intelligence and Causal Outcome Learning

P6 closes the loop:

state -> decision -> intervention -> measured outcome -> evidence -> state update.

## Intervention definition

Each intervention has:

- target dimension
- intended mechanism
- cost
- completion probability
- measurable outcome type
- production status

## Outcome hierarchy

P6 separates:

- immediate performance
- novel transfer
- delayed transfer
- timing
- calibration
- recovery
- decision behaviour

Improvement immediately after an intervention is not sufficient evidence of learning.

## Effect estimation

P6 supports:

1. Descriptive pre/post effect.
2. Between-group contrast.
3. Future quasi-experimental and randomized designs.

Descriptive and quasi-experimental estimates are not causal claims.

## Causal rule

Causal claims require a stronger design than simple pre/post change.

The implementation currently blocks causal certification for non-randomized designs.

## Utility

Intervention selection considers:

expected effect
× completion probability
− cost

Evidence quality and causal status constrain eligibility.

This is a development utility, not a certified production formula.

## Outcome measurement

An intervention must define an outcome before it is treated as useful.

The outcome should be measurable and preferably novel or transfer-based.

## Anti-circularity

The intervention outcome must be treated as new evidence. It cannot retroactively make the intervention appear successful merely because the model selected it.

## Safety

P6 does not:

- diagnose the candidate
- infer psychology
- claim causality from correlation
- automatically promote an intervention
- modify legacy readiness
- expose internal causal estimates to candidates

P6 remains a development model until causal and decision validation certify it.
