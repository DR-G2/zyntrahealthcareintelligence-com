# PIE Intelligence Forensic Audit Execution Log

Last updated: 2026-10-19
Repository: DR-G2/zyntrahealthcareintelligence-com
Working PR: #168, Fix PIE Intelligence evidence gates and mode isolation
Branch: fix/pie-intelligence-evidence-gates
Code checkpoint before this log update: fdf6775d8e43e4446fe1e045bed069175399bde2
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
- Latest inspected PR head before this log update: fdf6775d8e43e4446fe1e045bed069175399bde2; 24 files changed. Earlier run evidence below applies only to the listed historical commit checkpoints.
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
| P10 Public claims | STATIC REVIEW COMPLETE; VALIDATION PENDING | Reviewed canonical feature availability, homepage, Features, How It Works, FAQ, pricing, About, AMC prep, OSCE guide, Trust Your Gut, and legal disclaimer copy. Core marketing copy consistently qualifies release-dependent signals, labels illustrative examples, disclaims exam predictions/guarantees, and states AMC non-affiliation. Corrected Trust Your Gut upgrade copy that implied the analytics feature would reduce harmful answer changes; it now describes the observable first/final-answer comparison and limits it to completed history. CI on the exact latest branch head remains pending. Legal Terms page contains unresolved entity/contact/arbitration/jurisdiction placeholders; logged as a public-release/legal follow-up outside the PIE code change. |
| P11 Regression | STATIC REVIEW IN PROGRESS; CI PENDING | Reviewed six-dimension/50-observation gating, mode provenance, per-confidence 15-answer coverage, null/empty distinctions, history identity/answer-key handling, shadow isolation, public claim regression tests, protected /intelligence route, and AdminGate/ProtectedRoute. Added a safe generic Behaviour-analysis failure toast and a regression assertion to prevent surfacing raw function error text. Source contract reviewed; tests/build have not yet completed on the latest head because GitHub Actions runs remain queued. Runtime certification is not proven by PR-triggered workflows. |
| P12 Handoff | NOT STARTED | Do not merge/release until exit criteria and authorized runtime verification are met. |

## Immediate next action
P10 static review is complete and its copy-only correction is committed (`d79cd6416e1a024f823211728f82756d4a6e5317`). P11 static regression/security review is in progress. A second safe error-presentation fix is committed: `b14c072c31759496bfbb88b95595d283c03bd27c` changes Behaviour UI failures to a generic learner-safe message, and `15ecdfb967f9e421cd9476b2b9a6d4bc3d3316c4` adds a regression assertion. The current PR head observed at checkpoint time is `9c06fbaa609e0982050b4d0c185356d95cbc10a9`.

GitHub Actions remains queued rather than executing: Zyntra CI runs 39249213167 and 39249213136 and PIE/Nudge checks were queued on `15ecdfb967f9e421cd9476b2b9a6d4bc3d3316c4`; combined commit status returned no checks. A local clone/test run was also attempted but the runtime could not resolve github.com, so no local test/build result is available. These are validation blockers, not passes.

Continue P11 static inspection and use the newest observable CI run once it starts. Inspect job steps and logs, fix actual failures within approved boundaries, and rerun on the latest stable head. Do not claim tests/build/runtime certification pass while runs are queued. P7/P8 mode-provenance limitations and the P9 active-V2 Behaviour deployment/auth-contract limitations remain unresolved and must be carried into P12 handoff unless an approved authoritative source becomes available. Do not merge, deploy, modify schema/RLS/auth, change formulas/thresholds, or alter protected certification scripts without explicit authorization and evidence.

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


## P10 public-claims evidence (2026-10-19)
- Reviewed current branch versions of `src/data/featureAvailability.ts`, `src/pages/Home.tsx`, `src/pages/Features.tsx`, `src/pages/HowItWorks.tsx`, `src/pages/FAQ.tsx`, `src/pages/PublicPricing.tsx`, `src/pages/About.tsx`, `src/pages/AmcExamPreparation.tsx`, `src/pages/AmcPreparationForImgs.tsx`, `src/pages/AmcPart1Mcq.tsx`, `src/pages/AmcClinicalOsce.tsx`, `src/pages/TrustYourGut.tsx`, and `src/pages/Terms.tsx`.
- Shared availability copy distinguishes Live core capabilities from Beta and Coming soon functionality; pages say that related signals depend on activity/release, examples are illustrative, Zyntra is not affiliated with the AMC, and the product does not predict or guarantee exam outcomes.
- Found a user-facing Trust Your Gut upgrade claim promising to “reduce harmful answer changes”, which the analytics-only feature cannot substantiate. Replaced it with a neutral description of reviewing first/final answers and recorded change outcomes only where completed history supports comparison. Commit: `d79cd6416e1a024f823211728f82756d4a6e5317`.
- P10 source review is complete; validation remains pending until CI passes on the stable latest head and regression checks are inspected.
- Separate public-release issue discovered in Terms: placeholder legal entity, designated contact email, arbitration rules/institution, and jurisdiction/governing-law state remain. This is not silently edited as part of the PIE audit; it requires correct legal details before release.


## P10 public-claims audit checkpoint (2026-10-19)
- Reviewed public availability contract `src/data/featureAvailability.ts`, homepage, feature index, How It Works, AMC exam preparation, AMC Clinical OSCE page, AMC Part 1 page and public educational article copy.
- Found a concrete contradiction: OSCE availability was labelled `Coming soon` in the canonical feature list, but the AMC Clinical page advertised a `Try a demo station` link to `/stations?demo=true`, while `src/App.tsx` redirects `/stations` to `/practice/osce`. The same page described staged voice/demo availability despite the canonical public status saying the interactive module was not live.
- Fixed on branch: `src/pages/AmcClinicalOsce.tsx` removes the unsupported demo CTA, links to the live AMC Part 1 MCQ track, states that interactive/voice OSCE practice is not available in the current public release, revises the voice FAQ, and corrects SEO description. `src/pages/AmcExamPreparation.tsx` now states the interactive OSCE module is not available in the current public release rather than implying an active staged rollout.
- Commits: `6f0d25fc71f344a179d8291305760c244941c3ea`, `3afbcc9b0cc072d2b6cd37262c1bbe9f70fce1f3`, `fdf6775d8e43e4446fe1e045bed069175399bde2`.
- Latest observed PR head before this log update: `fdf6775d8e43e4446fe1e045bed069175399bde2`; PR remains open and unmerged. Workflow/status lookup returned no current-head runs/statuses. P10 is implemented but NOT validated until CI and source re-fetch checks complete. No production deployment or production data changes.


## P11 regression/security review checkpoint (2026-10-19)
- Reviewed the candidate-facing route: `/intelligence` is wrapped by `ProtectedRoute` and `ErrorBoundary`; legacy behaviour and Trust Your Gut routes redirect into the preserved intelligence tabs. `/v2-auth-diagnostic` remains behind `ProtectedRoute` and `AdminGate`.
- Reviewed `ReadinessPrism` and `readiness-prism-adapter`: selected mode filters attempt history; unknown labels are not normalized to Normal MCQ; authoritative dimensions are withheld unless mode matches, each dimension has a valid count of at least 50, and required alignment metadata is true; missing count/interval/quality stays null; confidence signal requires 15 valid scored answers at each confidence level in the selected mode and a mode-scoped authoritative calibration projection.
- Reviewed regression tests for dimension threshold boundaries, global-vs-dimension counts, mode separation, unavailable values vs observed zero, null-safe Trust Your Gut rendering, answer-change sequence consistency, caller identity/history RPC contracts, protected shadow layer, and public claims. Static test source is present, but not yet executed on the latest head.
- Security/UI correction: `src/pages/BehaviorProfile.tsx` no longer displays raw `e.message` in the learner toast when analysis fails; it now uses a generic temporary-unavailability message. Added a source contract assertion in `src/lib/pie/pie-edge-functions.test.ts`. Commits: `b14c072c31759496bfbb88b95595d283c03bd27c`, `15ecdfb967f9e421cd9476b2b9a6d4bc3d3316c4`.
- Current CI status: queued, no combined status checks on `15ecdfb967f9e421cd9476b2b9a6d4bc3d3316c4`; no local clone/build possible because the execution environment could not resolve github.com. Validation is still pending.
