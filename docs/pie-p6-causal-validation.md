# P6 causal validation

P6 uses the potential-outcomes distinction:

ITE(a,X) = E[Y | do(a), X] - E[Y | do(not a), X]

The implementation separates:

- observed pre/post improvement
- between-group association
- randomized causal evidence

A pre/post gain is not a causal effect.

## Validation sequence

Synthetic potential outcomes are generated with hidden true effects. Treatment assignment is separated from the outcome generator. The estimator is tested against the hidden effect.

Required future validation cases:

- randomized treatment
- confounding
- heterogeneous treatment effects
- missing outcomes
- non-compliance
- unequal baseline states
- delayed and novel-transfer outcomes
- decision utility
- causal effect uncertainty

No intervention becomes causally certified from a single candidate.

## Production gate

P6 remains development-only until:

1. outcome measurement is validated
2. causal recovery is validated
3. intervention decision validity is validated
4. causal claims are reproducible
5. candidate-facing output is separated from internal causal evidence

Legacy intervention tables remain untouched for compatibility.
