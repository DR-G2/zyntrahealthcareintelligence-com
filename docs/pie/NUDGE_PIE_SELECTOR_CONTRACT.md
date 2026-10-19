# Nudge ↔ PIE selector contract

Status: proposed, not deployed. This document and migration are for review only.

## Candidate-facing decision boundary

- Source of truth: server-saved `public.user_attempts` joined to the primary `pie.question_lo` mapping and active `pie.learning_objective`.
- Do not use `mastery_mean`, `mastery_lcb`, `evidence_maturity`, or shadow-inference estimates as direct Nudge selection inputs.
- A candidate gap requires at least 3 distinct mapped questions and either mapped accuracy <= 0.60 or at least 2 incorrect saved attempts in the last 30 days.
- Eligible Nudge content requires at least 3 active questions with a primary mapping to the chosen LO that the candidate has not attempted. No unmapped fallback.
- Selector is deterministic: lowest accuracy, then most recent misses, then stable `lo_key`.
- The RPC always returns an explicit status: `READY`, `INSUFFICIENT_EVIDENCE`, `NO_SUPPORTED_GAP`, or `NO_ELIGIBLE_QUESTIONS`.

## Security and integration constraints

- `auth.uid()` scopes all evidence and unseen-question checks to the caller.
- Server-side grading remains in `public.save_attempt`; this migration does not alter it.
- PIE telemetry remains on the existing save-attempt path, including confidence and answer-change sequence.
- No shadow-inference reads, no P12 inference-path changes, no client-supplied correctness.
- The branch now wires the Nudge tile to `create_my_nudge_session`, which creates a fixed LO-scoped session from unseen, active, primary-mapped questions. It uses the existing `save_attempt` path for grading and PIE telemetry.
- After completion, `get_my_nudge_progress` reports cumulative mapped accuracy for the targeted LO, and the results screen labels this as cumulative rather than claiming causal learning gain.
- The UI must remain unavailable in any environment where these reviewed migrations have not been applied. This branch has not been deployed.
- Migration has not been applied. No production data, deployed schema, merge, or deployment was changed by this proposal.

## Review gates before enablement

1. Run SQL verification against an isolated V2 database with fixtures for no evidence, below-threshold evidence, low-accuracy gap, repeated recent misses, insufficient unseen questions, and cross-user isolation.
2. Verify RPC grants and SECURITY DEFINER search path.
3. Apply migrations only to an isolated V2 database and verify the selector + session builder against controlled fixtures.
4. Confirm session results and PIE reassessment update from `save_attempt` without modifying `save_attempt`.
5. Run TypeScript, build, and test checks, including the static contract tests.
6. Run cross-user isolation, insufficient-evidence, no-gap, no-eligible-content, and successful-session integration tests.
7. Keep Nudge disabled in production until the full loop passes in staging and the migration is deliberately promoted.
