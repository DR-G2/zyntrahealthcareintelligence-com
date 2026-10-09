# P15 Controlled Production Exposure

## Gate

P15 exposes the already-certified P14 PIE read path through the production application path under a controlled, shadow-only contract.

P12, P13, and P14 remain protected regression baselines.

## Invariants

- `shadow_only=true`
- `authoritative=false`
- `influences_adaptation=false`
- P12 model version remains `pie-inference-v2.1-shadow`
- Browser never receives a service-role credential.
- Browser cannot directly read protected `pie` tables.
- Candidate identity is derived from the authenticated JWT.
- Candidate A cannot read candidate B's inference.
- No second scoring engine is introduced.
- PIE failure cannot block authoritative practice persistence.

## Certification

P15 is accepted only when:

1. Production application is reachable.
2. Unauthenticated PIE reads are rejected.
3. Two authenticated candidates receive their own inference.
4. Six P12 dimensions and provenance are preserved.
5. Cross-user isolation holds.
6. Direct protected-table reads are denied.
7. Projection-backed reads remain stable.
8. Unit tests, typecheck, and production build pass.
9. P14 passes 14/14.
10. P13 passes 10/10.
11. P12 passes 13/13.

This gate does not depend on Vercel, Netlify, or any frontend hosting provider. It certifies the Supabase PIE production boundary only.

This gate does not merge or deploy the frontend automatically.
