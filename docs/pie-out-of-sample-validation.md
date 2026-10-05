# PIE P2.3: Out-of-Sample and Temporal Validation

P2.3 adds an anti-leakage validation gate. It evaluates outcome prediction on observations that were not used for model fitting.

## Design

1. Split each candidate's sequence by time.
2. Fit on earlier observations.
3. Predict later observations.
4. Score only the held-out outcomes.
5. Repeat across independent seeds.
6. Report separate metrics for each model.

## Model ladder

A = accuracy only  
B = difficulty  
C = difficulty + timing pressure  
D = C + confidence  
E = D + answer-change behaviour  
F = E + sequential temporal signal

This is a validation ladder. It is not evidence that a later model is automatically better.

## Leakage rules

- Test outcomes are not used to fit the static predictors.
- A temporal predictor updates only after a test observation has been scored.
- Missing observations are excluded from outcome scoring.
- Each candidate is split independently.
- No candidate's future observations train another candidate's past.

## Metrics

Held-out binary outcome prediction uses:

- Brier score.
- Log loss.

Latent-state recovery remains a separate task. Outcome prediction must not be treated as proof that a hidden state was identified.

## Repeated seeds

The default runner uses seeds 101, 202, 303, 404, and 505.

The runner reports one result per seed and a separate mean for each model and metric. There is no composite winner score.

## Status

This is a development validation harness. It does not certify the hierarchical dynamic psychometric state-space model. It does not prove intervention effectiveness or causal validity.

Next gate: P2.4, temporal trajectories with change-point and recovery validation under the same train/test discipline.
