# PIE P2.4: Temporal Trajectory Validation

P2.4 tests whether the validation lab can distinguish performance trajectories over time.

## Synthetic regimes

1. Stable performance.
2. Gradual decline.
3. Sudden change.
4. Decline followed by recovery.

Hidden trajectory truth is generated separately from observed outcomes.

## Measurements

State recovery uses RMSE between estimated rolling state and hidden capability.

Change-point validation reports detected point, absolute error, and missing detection. Gradual change is not forced into the same interpretation as a sudden change.

Recovery uses:

RF = (P_R - P_L) / (P_B - P_L)

where P_B is baseline performance, P_L is low-performance performance, and P_R is recovery performance.

Stable trajectories are checked for false change detection.

## Safety boundary

The synthetic variable is performance state. It must not be presented as clinical or psychological fatigue. User-facing language should use sustained-performance decline unless a separate validated inference supports a stronger interpretation.

## No composite score

RMSE, change-point error, recovery error, and false-change rate remain separate metrics.

## Status

Development validation only. This does not certify the final hierarchical dynamic psychometric state-space model.

Next gate: P2.5, interruption and technical-contamination validation.
