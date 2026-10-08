# P12 Controlled Shadow Inference Certification

## Purpose

P12 establishes the advanced `pie-infer-state` Edge Function as a **shadow-only inference path**.

It may read trusted learner evidence and calculate the six PIE inference dimensions, but it must not alter authoritative learner state, question selection, scoring, or adaptation.

## Six dimensions

- capability
- decision
- timing
- calibration
- sustained_performance
- learning

Each inference carries an uncertainty estimate, confidence interval, evidence count/quality, evidence maturity, and model provenance.

## Security contract

- authenticated requests only
- requested `user_id` must match the authenticated user
- service-role access is confined to the Edge Function
- raw `pie.inference_shadow` remains protected from learner direct reads
- no client-supplied correctness or PIE state is trusted
- wildcard CORS is prohibited
- shadow inference cannot influence adaptation

## Determinism

The six-dimensional result is canonicalized and hashed. Repeated invocation against unchanged evidence must produce the same inference hash.

## Authoritative-state isolation

P12 explicitly checks that invoking `pie-infer-state` does not mutate the authoritative `get_my_pie_state` result.

## Promotion rule

P12 does **not** promote the advanced inference engine into the adaptive decision loop.

Promotion requires a later gate demonstrating:

1. stable live invocation,
2. cross-user isolation,
3. deterministic/reproducible inference,
4. agreement analysis against the current authoritative state,
5. real-user shadow observations,
6. failure recovery,
7. measurable benefit before inference is allowed to influence adaptation.

## Model status

Current model: `pie-inference-v2.1-shadow`.

This is an engineering shadow model, not a validated psychometric model and not an AMC pass-probability model.


## CI note

P12 certification requires the repository typecheck gate to remain green; unrelated security RPC declarations are preserved in the generated application type surface.
