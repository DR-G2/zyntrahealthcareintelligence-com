# PIE P7: Runtime Orchestration and Safety Boundary

P7 connects the validated architecture into one runtime decision path.

```
Observation
  -> Candidate State
  -> Question State
  -> DWIG
  -> Runtime Decision
  -> Measured Outcome
  -> Intervention Evidence
  -> State Update
```

## Runtime contract

The runtime receives candidate state, question state, context, and optional intervention evidence.

It returns:

- selected question
- selected version
- decision context
- model provenance
- uncertainty
- rationale
- internal decision identifier

The runtime decision is not automatically candidate-facing.

## Modes

SHADOW:
- observe only
- no promotion
- no candidate-facing decision

DEVELOPMENT:
- executable development path
- no certification claim

VALIDATING:
- validation environment
- no automatic promotion

CERTIFIED:
- eligible for controlled promotion only after validation gates

## Safety boundary

P7 does not:

- create a single readiness score
- overwrite legacy readiness
- make causal claims from correlation
- bypass question protection
- expose internal uncertainty/effect estimates to candidates
- promote itself because a test passed
- treat exam context as candidate state

## Runtime invariant

A model decision must carry provenance.

A decision without model version and uncertainty is invalid.

## Production promotion

Promotion requires an explicit external certification decision. P7 does not auto-promote.
