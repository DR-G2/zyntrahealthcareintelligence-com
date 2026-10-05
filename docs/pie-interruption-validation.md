# PIE P2.5: Interruption and Technical Contamination Validation

P2.5 tests whether telemetry can be observed without being mistaken for a candidate-performance state change.

## Interruption classes

- TAB_HIDDEN
- WINDOW_BLURRED
- SESSION_PAUSED
- PAGE_REFRESHED
- NETWORK_OFFLINE

These events are evidence about the environment. They are not evidence that a candidate became less capable.

## Synthetic design

The candidate's hidden capability remains constant across the interruption.

The generator creates telemetry events in the middle of the sequence. Outcomes continue to be generated from the same hidden capability.

The validation compares:

- performance before interruption
- performance during interruption
- performance after interruption
- a later control window
- contamination delta

## Interpretation rule

A telemetry event may explain a change in the observation environment. It must not, by itself, create a candidate-state transition.

The relevant question is:

**Did performance change after the interruption, beyond the change expected from ordinary observation noise?**

Not:

**Did the candidate leave the screen?**

## Data-quality boundary

Telemetry is classified separately from performance:

VALID  
SUSPICIOUS  
CONTRADICTORY  
UNUSABLE

A technically inconsistent event must reduce evidence quality. It must not automatically reduce candidate capability.

## Safety boundary

The system may report known events such as tab hidden, focus lost, session paused, refresh, or network loss.

It must not infer which unrelated application or website the candidate used.

## Status

Development validation only. P2.5 does not prove that telemetry improves prediction or that an interruption caused a performance change.

Next gate: P2.6, missing-data and false-certainty stress testing.
