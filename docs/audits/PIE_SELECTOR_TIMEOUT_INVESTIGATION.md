# PIE selector timeout investigation

## Observed failure
P20 production certification on the metric-remediation branch passed P20-01 through P20-18, then the `pie_next_question` RPC timed out at P20-19. P20-20 could not verify a decision trace because the preceding RPC failed. P20-21 through P20-24 passed. P21.1 telemetry integrity passed 18/18. This establishes a selector-path timeout in that run, not a definitive root cause.

## Change proposed
Migration `0085_pie_selector_performance_indexes.sql` adds targeted indexes for:
- session question membership and exclusion;
- learner attempts joined to completed sessions;
- per-learner/per-session decision-trace lookups;
- open quarantine membership.

It runs ANALYZE for affected tables after index creation. It does not change question ranking, selection weights, eligibility, candidate data, the protected P12 inference path, or certification gates.

## Acceptance gate
1. CI and protected P20/P21 source-integrity gates pass.
2. Apply the migration only through the normal migration release process.
3. Re-run the P20 production deployment gate and verify P20-19 and P20-20 pass.
4. Compare query duration before/after and inspect EXPLAIN (ANALYZE, BUFFERS) for the ranking query using a safe disposable session.
5. If the timeout persists, capture PostgreSQL statement/query logs and profile `pie.rank_candidates`; do not increase timeouts or weaken certification to mask it.

## Safety
No production migration was applied as part of preparing this change. Index creation may consume database resources and should be reviewed against production load before release.
