# PIE P10 Production Gate

P10 is the current production-integration phase. The historical P10 shadow runtime is retired as a learner-product mode. Shadow infrastructure may remain only as an internal model-lab mechanism.

## Gate

`pie.run_p10_production_gate()` verifies:

1. exactly one active PIE model version
2. raw PIE state has no SELECT grants for `anon` or `authenticated`
3. learner-safe PIE state endpoint exists
4. `save_attempt` is server-authoritative / SECURITY DEFINER
5. retired `public.pie_shadow_run` serving function is absent

The gate is stored in `pie.production_gate` and is internal only.

## Production boundary

Practice remains authoritative for:
- answer correctness
- scoring
- authentication
- ownership

PIE is authoritative for:
- performance-intelligence state
- uncertainty
- bounded behavioural inference
- temporal dynamics
- learner-safe intelligence signals

PIE failure must never block authoritative attempt persistence.

## Current live gate

P10 production boundary: PASS.

This is a boundary/infrastructure gate. It does not by itself certify clinical validity, AMC readiness prediction, causal intervention effects, or the entire P11 certification suite.