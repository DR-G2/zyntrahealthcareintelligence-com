# PIE Intelligence Forensic Audit Execution Log

Last updated: 2026-10-19
Repository: DR-G2/zyntrahealthcareintelligence-com
Working PR: #168, Fix PIE Intelligence evidence gates and mode isolation
Branch: fix/pie-intelligence-evidence-gates
Code checkpoint before this log update: 503546e5f94b9cb0a17e7a9ff7c7d00ec798913e
Base: main at 1be79d37602e83cf68728e3e98084e91ffcfe932

## Non-negotiable rules
- Preserve all six PIE dimensions, map, Building states, evidence counts, calibration, subject performance, Behaviour, Trust Your Gut, Next Best Action, evidence transparency, refresh, and protected admin diagnostics.
- Each dimension needs at least 50 valid observations scoped to that dimension before any value can display. Threshold permits evaluation, not automatic validity.
- Calibration needs at least 15 valid answers at each confidence level 1–5.
- Keep Normal MCQ, AMC Exam mode (150 questions / 210 minutes / no backtracking), Nudge, and OSCE separate. Do not infer unknown mode.
- Missing is not zero. Do not invent counts, intervals, scores, readiness, pass likelihood, or clinical validity.
- Do not change PIE inference formulas, schema/migrations, production data, RLS/auth, or protected certification scripts without explicit approval.
- A green build or merge does not prove runtime certification or Lovable production deployment.

## Verified current state
- PR #168 is open, not merged; GitHub reports mergeable=true.
- PR head before this log update: 503546e5f94b9cb0a17e7a9ff7c7d00ec798913e; 17 files changed.
- P8 current-head CI: run 39247912982 passed lint/unit tests/production build; run 39247912854 passed unit tests/build/P8-P11 contract gate; run 39247912947 passed unit tests/typecheck/build. Runtime certification steps were skipped by pull-request guards.
- P9 code checkpoint `503546e5`: run 39248401148 passed lint/unit tests/production build; run 39248400959 passed unit tests/build/P8-P11 contract gate; run 39248400921 passed unit tests and typecheck (production build was in progress at last check); run 39248400960 passed unit tests and typecheck (production build was in progress at last check). PIE/Nudge live certification steps were skipped by PR guards.
- CI workflow run 39244106934 (Zyntra CI #1551): completed, success.
- PIE live certification workflow run 39244106885 (#489): workflow conclusion success, but its actual "Run PIE live certification" step was SKIPPED because workflow only runs authenticated certification outside pull_request events.
- Nudge live certification workflow run 39244106821 (#125): workflow conclusion success, but its actual "Run authenticated Nudge runtime certification" step was SKIPPED for the same pull-request guard.
- Therefore neither live runtime certification is verified by these PR runs.
- Other workflow runs on the inspected commit: 39244106971 (PIE P21.1 Production Telemetry Integrity #454) success; 39244106748 (PIE P21.2 Decision-Trace Integrity #446) success; 39244106849 (Zyntra CI #876) success. Inspect job steps/run context before using these as evidence for any specific contract.
- No production deployment has been verified. PR remains unmerged and no Lovable release is verified.

## Work already present in PR #168
- Per-dimension evidence count fields and 50-observation gating in candidate-facing adapter/map.
- Calibration coverage checks and fail-closed behaviour where authoritative mode provenance is absent.
- Explicit practice-mode selector and mode-filtered attempt summaries.
- Ambiguous legacy modes and orphan sessions are not silently normalized to Normal MCQ.
- Completed-answer/key requirement before scoring relevant PIE history.
- Missing-data protections in Behaviour and Trust Your Gut.
- Trust Your Gut null-safe score rendering and history error/retry state.
- Tests added for global-count/per-dimension disagreement, exactly-50 display, mode separation, and withholding unsupported cross-mode calibration.
- The current authoritative my_pie_state projection does not reliably provide dimension-specific evidence counts or mode scope; my_confidence_intelligence and my_readiness also lack verified mode scope. Do not fabricate these contracts.

## Phase log
| Phase | State | Evidence / blocker |
|---|---|---|
| P0 Baseline | PARTIAL, checkpoint captured | PR/branch/head/13-file diff and CI run IDs verified. Full repository baseline and all workflow/source-integrity checks have not been exhaustively recorded. |
| P1 Source inventory | PARTIAL | Inspected ReadinessPrism, intelligence-evidence adapter, history mapping, BehaviourProfile and analyze-behavior. Full six-dimension source lineage and every visible element remain to be inventoried. |
| P2 Gating contract | PARTIAL | 50 per dimension and 15 per confidence level are fixed. Authoritative projections do not currently establish all required dimension-specific/mode-scoped provenance. |
| P3 Dimension gating | IMPLEMENTED, REGRESSION EVIDENCE INCOMPLETE | Code and tests exist; require full run results and verify every rendering/accessibility path. |
| P4 Calibration gating | IMPLEMENTED, REGRESSION EVIDENCE INCOMPLETE | Coverage gate exists; mode scope of authoritative calibration projection remains unavailable, so estimate is withheld. |
| P5 Map/banner | PARTIAL | Map omits unsupported plotted points and labels partial state. Need complete combinations/responsive verification. |
| P6 Missing-data handling | PARTIAL | Several fixes present; full audit of all tiles, subject metrics, actions, provenance, refresh and timestamps pending. |
| P7 Behaviour | CODE VALIDATION PASS; AUTHORITATIVE MODE PROVENANCE BLOCKED | Backend accepts only explicit `normal` / `normal_mcq` labels; removes unused OSCE, psychograph and behaviour-DNA reads; constrains AI descriptions to supplied signals; validates AI output before persistence; returns errors if profile lookup/write fails; unsupported score predictions are removed/cleared; missing timing remains null end-to-end. Zyntra CI run 39247028497 passed lint, unit tests and production build on code checkpoint 00c7435. P21.2 workflow run 39247028479 passed unit tests, typecheck and build; its runtime integrity steps were skipped by PR guard. V2 history currently emits `adaptive` for the relevant RPC contract and does not expose verified Normal MCQ vs Nudge provenance. Do not treat `adaptive` as Normal MCQ; fail closed until authoritative mode scope is available. |
| P8 Trust Your Gut | IMPLEMENTED; STATIC VALIDATION PASS; RUNTIME MODE PROVENANCE BLOCKED | Uses the caller-scoped `get_my_attempt_history` RPC through `fetchLegacyShapedHistory`; answer keys are exposed only after completed sessions. Explicit mode labels remain separate. Added null-safe accuracy rendering, rejects malformed/empty answer-change entries instead of coercing objects to strings, checks `answer_changes_count = sequence length - 1` and last sequence answer matches final selected answer, normalizes answer comparisons, excludes inconsistent answer-key rows, and keeps trend denominators separate when first-answer evidence is unavailable. CI run 39247912982 passed lint, unit tests, and production build; run 39247912854 passed tests, build and P8-P11 contract gate; run 39247912947 passed tests, typecheck and build. All on code checkpoint `5e13149`. Mode provenance still prevents ambiguous adaptive sessions being counted as Normal MCQ. |
| P9 Security/provenance | PARTIAL; AUTH/DEPLOYMENT BLOCKERS RECORDED | Verified source guards: `ProtectedRoute`, `AdminGate` (allowlist plus `is_admin` RPC), caller V2 JWT and same-learner email check in `fetchCallerPieHistory`, caller-scoped `get_my_attempt_history`, own-user `behavior_profiles` RLS in the legacy migration, and server-owned profile writes keyed to authenticated `user.id`. On active V2 project `hkowvjazuwebmibssdut`, read-only SQL confirmed `get_my_attempt_history` and `get_my_pie_state` are SECURITY DEFINER with EXECUTE granted to authenticated but not anon; both bodies scope via `auth.uid()`. `pie_candidate_state`/`pie_observation` have RLS on and no anon/authenticated SELECT grants; readiness/confidence/next-best-action tables have RLS and own-user SELECT policies; learner views are `security_invoker=true`, SELECT granted to authenticated only. P9 code fix removes internal RPC/runtime error text from learner responses and adds POST/OPTIONS CORS methods; CI passed. Blocker: active V2 has no deployed `analyze-behavior` function, no `public.behavior_profiles` table, and no `public.is_admin(text)` function; current legacy backend deployment cannot be inspected from the connected project. Source `analyze-behavior` uses `ilike` for admin email matching, which treats `%`/`_` as wildcards. Do not change authorization/RLS or port schema/function without explicit approval. |
| P10 Public claims | PARTIAL | Metadata copy revised to avoid readiness claims; inspect all feature cards/status declarations and route promises. |
| P11 Regression | PARTIAL | Zyntra CI #1551 green; runtime cert steps skipped on PR; comprehensive matrix and security tests not yet proven. |
| P12 Handoff | NOT STARTED | Do not merge/release until exit criteria and authorized runtime verification are met. |

## Immediate next action
Proceed to P10 Public claims, which is independent of the P9 backend/auth blockers. Current-head Zyntra CI run 39248401148 passed lint, unit tests and production build; run 39248400959 passed tests/build/P8-P11 contract gate; run 39248400921 passed tests and typecheck, with build running at last inspection. Run 39248400960 also passed tests and typecheck, with build running. PIE/Nudge runtime certification steps were skipped on PR triggers. Do not change auth/RLS or add a V2 schema/function without explicit approval. Preserve the fail-closed mode mapping.

## Resume protocol
On resumption, fetch this file and the live PR metadata/HEAD again before editing. Confirm no newer commits supersede this checkpoint. Update this log after each phase with exact files, commit SHA, test command/run ID and observed result. Never mark PASS without evidence.


## P7 change evidence (2026-10-19)
- Commits on the PR branch: `fc58a861` (preserve session_mode in history mapping), `a33a3b5f` and `ad7922a5` (Normal MCQ-only behavior analysis and no schema field write), `5e321cf3` (contract tests), `3333033e` and `c46b945e` (exclude unscoped behavior DNA, psychograph and population context), `3c4b2306` and `6d50e0a5` (nullable timing evidence; no missing-time-to-zero aggregation).
- Subsequent P7 fixes: `9da0f450` preserved missing subject timing as null and added a contract assertion; `0d6678bb` removed unused cross-mode reads; `b7e11463` constrained AI classifications to supplied Normal MCQ signals; `df8f0571` added regression assertions; `d33f45fc` aligned nullable timing types in the UI; `c9aa0f62` made profile lookup/write errors fail closed; `a81b7731` added persistence error assertions; `f0c752c2` validates AI classification structure before persistence; `00c74352` adds regression assertions for invalid AI output.
- P8 changes on the branch: `aa725857` guarded null accuracy cards; `2be83bb7` added null-render test; `b910f712` rejects malformed answer sequences; `7537910d` tests malformed sequences; `90e10dcf` enforces sequence/count consistency and null trend denominators; `30ef1838` adds contract tests; `a42097b9` rejects empty sequence entries; `bb21d5e5` adds tests; `a4eb584c` normalizes the four accuracy render paths; `e09c0a8d` tests guards; `4111631a` stabilizes helper; `21fe0be5` requires final answer to match the sequence; `87303b99` adds the regression assertion; `6ff5511a` normalizes answer-key comparisons; `33bb580d` corrects final answer comparisons; `5e131491` aligns the static assertion with normalized matching.
- Zyntra CI run 39247028497 on `00c7435` passed lint, unit tests, and production build. P21.2 workflow run 39247028479 passed unit tests, typecheck, and build; its protected runtime-integrity certification steps were skipped for pull-request events. P21.1 and other current-head workflow results must be inspected separately; workflow success alone does not imply runtime certification.
- The authoritative V2 history contract is evidenced by `supabase/verification_v2/pie_p5/verify_0060.sql`, which asserts `session_mode = 'adaptive'`; the current history projection does not supply the separate config mode required to identify Normal MCQ vs Nudge. This is a real source-contract limitation, not a reason to relabel `adaptive`.
- No schema/migration, production data, auth/RLS or PIE inference formula was changed. PR #168 remains open and unmerged.


## P9 security/provenance evidence (2026-10-19)
- Live project inspected read-only: `hkowvjazuwebmibssdut` (zyntra-production, ACTIVE_HEALTHY). No database/schema/auth/RLS changes were made.
- Live catalogs confirm `public.my_pie_state`, `public.my_readiness`, `public.my_confidence_intelligence`, and `public.my_next_best_actions` use `security_invoker=true`; anon SELECT is false and authenticated SELECT is true. Underlying intelligence tables have RLS enabled and own-user SELECT policies. Internal `pie.pie_candidate_state` and `pie.pie_observation` have RLS enabled and no anon/authenticated SELECT grants.
- Live function catalog: `public.get_my_attempt_history(integer,timestamptz,uuid)` and `public.get_my_pie_state()` are SECURITY DEFINER, executable by authenticated but not anon, and both enforce `auth.uid()` ownership in their bodies.
- Live V2 Edge Function inventory does not include `analyze-behavior`; active V2 has no `public.behavior_profiles` table and no `public.is_admin(text)` function. This PR cannot be called runtime-complete for Behaviour on active V2 without an approved backend/schema port. The connected legacy project/function is not available for source/runtime verification.
- Source-only security fix: learner responses no longer echo raw history RPC errors or exception messages; explicit `Access-Control-Allow-Methods: POST, OPTIONS` added. No auth/RLS behavior changed.
- Approval blocker: source admin entitlement query uses `ilike(user.email)`; SQL wildcard characters in email patterns could broaden matching if the legacy table path is active. Do not change auth logic silently; this needs explicit authorization approval and verification against the actual deployed legacy function.
