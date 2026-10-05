# PIE P2.6: Missing Data and False-Certainty Validation

## Purpose

P2.6 is the final P2 validation gate.

It tests whether missing observations can produce false confidence, false state changes, or false certainty.

## Missingness mechanisms

The synthetic laboratory includes:

- MCAR: missing independently of observed variables
- MAR: missingness depends on an observed pattern
- MNAR: missingness depends on the unobserved outcome

These are stress conditions. They are not claims about how Zyntra candidates behave.

## Core rule

Missing data is not negative evidence.

A missing observation must not be converted into:

- incorrect
- slow
- low confidence
- poor capability
- fatigue
- distraction

Instead, missingness changes the evidence available to the estimator.

The model should therefore expose:

**Estimate + uncertainty + evidence status**

not an estimate alone.

## False-certainty test

The dangerous failure is not only a wrong estimate.

A more serious failure is:

> wrong or weakly supported estimate + high confidence

The validation therefore checks whether low evidence can silently produce a highly certain state.

## Evidence states

The laboratory uses:

- INSUFFICIENT
- PRELIMINARY
- SUPPORTED

These are validation labels, not production thresholds.

No fixed question count is used as the scientific definition of evidence sufficiency.

## Boundaries

P2.6 does not establish the final uncertainty distribution or final evidence thresholds for production PIE.

It establishes the engineering requirement that missingness must not create unsupported certainty.

## P2 completion

After P2.6, the P2 validation laboratory is structurally complete.

P3 can then implement and validate the actual state-inference engine.
