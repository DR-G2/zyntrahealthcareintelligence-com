# P14 Production PIE Read-Path Hardening

## Contract

P14 is an application read-path hardening layer above certified P12 and P13.

`P12 inference -> protected shadow output -> P14 projection -> authenticated dashboard`

P14 never calculates PIE dimensions. It accepts the certified P12 six-dimensional contract only.

## Projection

`pie.inference_projection` stores one latest canonical P12 projection per candidate.

Stored fields include:
- inference hash
- observation count
- latest observation id/time
- six raw dimensions
- model version
- source state version
- evidence maturity
- signal quality
- explanation
- inference timestamp
- shadow/adaptation security markers

The table is RLS-enabled and has no anon/authenticated grants. Only server-side service_role access is granted.

## Freshness

P14 first checks the authenticated candidate's observation count and latest observation id.

If the protected projection matches those values and contains all six dimensions, P14 returns it directly with `read_source=projection`.

If the projection is missing or stale, P14 invokes certified P12, validates the complete contract, stores the exact P12 dimensions, and returns `read_source=p12_refresh`.

If refresh fails, P14 fails closed. It does not serve a stale mixed inference as current.

## Security

- Browser sends only the user session JWT.
- Candidate scope comes from `auth.getUser()`.
- Client-supplied `user_id` is ignored.
- Browser cannot directly read `pie.inference_projection` or `pie.inference_shadow`.
- Service-role credentials remain server-side.
- P14 requires JWT verification.
- No raw observations, tokens, user IDs, or inference values are written to custom logs.

## Failure states

P14 returns explicit states for:
- no observations / no inference
- projection read failure
- observation read failure
- P12 unavailable
- P12 contract violation
- projection write failure
- incomplete projection

The frontend never fabricates missing inference values.

## Regression gates

Every P14 certification run must pass:
- unit tests
- TypeScript typecheck
- production build
- P14 authenticated read-path certification
- P13 certification: PASS=10 FAIL=0
- P12 certification: PASS=13 FAIL=0

The certified P12 and P13 source files are diff-protected from the P12/P13 baseline commit `79b3aa33f5102597f8a670153fe273ec097180d8`.
