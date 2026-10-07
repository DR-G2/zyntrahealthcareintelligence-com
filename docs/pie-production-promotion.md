# PIE Production Promotion

## Production role

PIE is now the production Performance Intelligence Engine for the learner-facing Intelligence page.

The production boundary is:

- Practice and assessment systems remain authoritative for answer correctness, scoring, authentication, and ownership.
- PIE is authoritative for performance-intelligence state, uncertainty, behavioural inference, temporal dynamics, and bounded intelligence signals.
- Learner-facing PIE state is exposed only through the authenticated PIE Edge Function boundary.
- Internal PIE tables remain service-role controlled.

## Shadow infrastructure

The P10 shadow runtime is intentionally retained as a model-lab layer.

`pie-shadow-run` and `pie_shadow_run` remain non-candidate-facing and legacy-authoritative. They may be used for:

- experimental model versions
- regression comparison
- certification evidence
- controlled A/B evaluation
- future model promotion

Shadow mode is therefore no longer the learner product mode. It is an internal validation mode.

## Failure rule

PIE is downstream of authoritative practice persistence. A PIE failure must never block saving an answer or completing a practice session.

## Production loop

Practice attempt -> persisted authoritative attempt -> PIE observation normalization -> PIE inference -> persisted candidate state -> Intelligence UI.

## Netlify

Netlify serves the React application. Supabase Edge Functions provide the authenticated PIE backend boundary. No PIE service-role secret is placed in the browser.