# PIE offline self-training: Gate 0

This directory is an offline-only preparation path for PIE mastery prediction. It must not call production write RPCs, mutate PIE tables, alter the authoritative selector, or deploy a model.

## Current execution boundary

- Supabase access is read-only.
- No model is trained by Gate 0.
- No candidate-level data is exported by the SQL audit.
- No synthetic or certification record may be counted as human-candidate training data.
- No training run may proceed until source provenance and lawful purpose are explicitly approved.

## Run the read-only database audit

Run `scripts/pie-training/sql/gate0_readonly_quality_audit.sql` using a read-only database role in the approved environment. Store aggregate output only. Never paste names, emails, answer histories, or raw candidate payloads into issue trackers or commit them.

## Provenance policy

`src/lib/pie/training/provenance.ts` implements a conservative classification helper:

1. Registered synthetic candidates are always classified synthetic.
2. Synthetic/fixture/seed/mock/demo labels are classified synthetic.
3. Certification/test/smoke/QA/staging/E2E labels are classified test/certification.
4. Only a separately reviewed and explicitly approved source can be classified as verified real-candidate data.
5. Unknown or missing provenance remains unknown and is not eligible for human training.

This helper is a guardrail, not a substitute for source-owner review. Certification and synthetic source labels override the explicit approval flag.

## Next gates

1. Reconcile source provenance, identities, consent/purpose, and the production question inventory.
2. Validate attempt/observation/LO joins and all quality checks.
3. Build point-in-time features and future outcome labels offline.
4. Compare smoothed LO and logistic-regression baselines with temporal holdout evaluation.
5. Keep synthetic experiments in a separate namespace/report.
6. Start intervention learning only after delivery and outcome records exist.
7. Any future serving change requires separate review and explicit approval.

## Non-goals

- No migrations or production writes.
- No changes to `public.save_attempt`, inference RPCs, selector functions, RLS, or Edge Functions.
- No model promotion or candidate-facing output.
- No causal claims from descriptive pre/post change.
