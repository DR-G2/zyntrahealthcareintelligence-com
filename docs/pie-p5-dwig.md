# PIE P5: Decision-Weighted Information Gain

P5 chooses the next observation by asking:

**Which eligible observation is expected to reduce decision-relevant uncertainty most?**

## Principle

DWIG is not:

- a difficulty sorter
- a raw question recommendation score
- a readiness score
- a fixed weighted composite

Conceptually:

DWIG(q) = expected reduction in decision uncertainty from observing q.

The selected action is the eligible observation with the highest expected decision value under the current state and evidence.

## Decision uncertainty

P5 keeps candidate-state uncertainty separate from exam readiness.

No readiness latent state is introduced.

## Eligibility

A question can be excluded when:

- it is still protected by P4
- question uncertainty is high
- question evidence quality is too low
- the question is not production-ready

## Safety

P5 does not allow uncertain question behaviour to silently become candidate evidence.

## Future validation

P5 must be validated using:

- information gain calibration
- decision uncertainty reduction
- DWIG regret against an oracle
- question protection
- missing-data robustness
- exam neutrality
- out-of-sample decision validity

P5 remains a development model until those tests certify it.
