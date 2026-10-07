> **DEPRECATED (P1/P2, 7 Oct 2026):** shadow pipelines are retired by ruling. `pie-shadow-run` / `pie-shadow-sync` were removed and `pie.pie_shadow_run` is sealed by `migrations_v2/0047_pie_deprecate_shadow.sql`. Historical record only.

# PIE P10 Shadow Deployment

## Runtime contract

P10 runs PIE beside the existing Zyntra system.

```
Candidate activity
      |
      +----> Legacy production path ----> authoritative output
      |
      +----> PIE shadow path -----------> internal decision + telemetry
                                           |
                                           X candidate-facing
```

## Shadow rules

- PIE mode is SHADOW.
- Candidate-facing output is always false.
- Legacy readiness remains authoritative.
- PIE does not overwrite legacy readiness.
- Interventions are not activated.
- PIE decisions are persisted for audit.
- Runtime errors are recorded.
- The shadow path must be removable without changing the legacy path.

## Shadow endpoint

`supabase/functions/pie-shadow-run/index.ts`

It authenticates the current user, creates a shadow run, evaluates the current PIE runtime against production-status question states, records the internal runtime decision, and closes the run.

## P10 evidence

Shadow deployment is not certification.

The required evidence is:

1. runtime stability
2. data integrity
3. no candidate-facing leakage
4. no legacy regression
5. agreement/disagreement analysis between legacy and PIE where comparison is valid
6. telemetry completeness
7. error and latency monitoring

No promotion decision is made automatically.
