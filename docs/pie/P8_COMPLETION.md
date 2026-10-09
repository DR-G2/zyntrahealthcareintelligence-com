# P8 Advanced Inference

Status: **LIVE / AUTHORITATIVE**

## Production contract

- Model: `pie-inference-v2.0`
- Source of truth: server-authoritative `pie.learner_lo_state`
- Dimensions:
  - capability
  - decision
  - timing
  - calibration
  - sustained performance
  - learning
- Every dimension carries:
  - estimate
  - uncertainty
  - lower/upper bounds
  - evidence count
  - evidence maturity
  - signal quality
  - model version
  - source state version
- No causal learning claims are emitted.
- Raw inference state is not directly readable by API roles.
- Learner-safe RPCs expose only the caller's own inference.
- `save_attempt` rebuilds authoritative inference and adaptive policy after authoritative grading/LO rebuild.
- A database trigger provides the same rebuild path for other legitimate attempt insertion paths.
- `pie-infer-state` is deployed with JWT verification and now invokes the authoritative inference RPC.
- Adaptive policy shadow consumes the authoritative inference capability/uncertainty signal.

## Safety

Inference remains uncertainty-aware. Low evidence does not produce high-confidence learner claims. P8 does not alter answer keys, grading, or raw attempt evidence.

## Promotion

The previous `pie.inference_shadow` implementation is retained for comparison/observability. It is no longer the authoritative state driver.

## Validation

Live validation confirmed:
- six inference dimensions generated for a learner with evidence
- model version `pie-inference-v2.0`
- uncertainty present
- source state version present
- raw API SELECT denied
- adaptive policy rebuild consumes the promoted inference state
- no active test security restrictions remain
