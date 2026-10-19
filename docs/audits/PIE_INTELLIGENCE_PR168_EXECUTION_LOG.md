# PIE Intelligence Forensic Audit Execution Log

Last updated: 2026-10-19
Repository: DR-G2/zyntrahealthcareintelligence-com
Working PR: #168, Fix PIE Intelligence evidence gates and mode isolation
Branch: fix/pie-intelligence-evidence-gates
Code checkpoint before this log update: 00c7435250e430e3c3e4d80ed70fe4d294b8f725
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
- PR head before this log update: 00c7435250e430e3c3e4d80ed70fe4d294b8f725; 17 files changed.
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
| P8 Trust Your Gut | PARTIAL | Mode filtering and null-safe denominators added; verify query provenance, answer sequence consistency, category and session calculations. |
| P9 Security/provenance | NOT VERIFIED | Client-side checks do not prove server authorization. Review edge function auth, own-candidate data boundaries and admin guard. |
| P10 Public claims | PARTIAL | Metadata copy revised to avoid readiness claims; inspect all feature cards/status declarations and route promises. |
| P11 Regression | PARTIAL | Zyntra CI #1551 green; runtime cert steps skipped on PR; comprehensive matrix and security tests not yet proven. |
| P12 Handoff | NOT STARTED | Do not merge/release until exit criteria and authorized runtime verification are met. |

## Immediate next action
Proceed to P8 Trust Your Gut using the same strict mode-provenance rules. P7's lint, unit tests, typecheck, and build have passed on the code checkpoint above. P7's runtime Normal MCQ analysis remains fail-closed because the authoritative V2 history contract reports `adaptive` without distinguishing Normal MCQ from Nudge. Do not guess that mapping or change schema/migrations without explicit approval. Runtime PIE/Nudge certification steps were skipped on PR triggers and remain unverified.

## Resume protocol
On resumption, fetch this file and the live PR metadata/HEAD again before editing. Confirm no newer commits supersede this checkpoint. Update this log after each phase with exact files, commit SHA, test command/run ID and observed result. Never mark PASS without evidence.


## P7 change evidence (2026-10-19)
- Commits on the PR branch: `fc58a861` (preserve session_mode in history mapping), `a33a3b5f` and `ad7922a5` (Normal MCQ-only behavior analysis and no schema field write), `5e321cf3` (contract tests), `3333033e` and `c46b945e` (exclude unscoped behavior DNA, psychograph and population context), `3c4b2306` and `6d50e0a5` (nullable timing evidence; no missing-time-to-zero aggregation).
- Subsequent P7 fixes: `9da0f450` preserved missing subject timing as null and added a contract assertion; `0d6678bb` removed unused cross-mode reads; `b7e11463` constrained AI classifications to supplied Normal MCQ signals; `df8f0571` added regression assertions; `d33f45fc` aligned nullable timing types in the UI; `c9aa0f62` made profile lookup/write errors fail closed; `a81b7731` added persistence error assertions; `f0c752c2` validates AI classification structure before persistence; `00c74352` adds regression assertions for invalid AI output.
- Zyntra CI run 39247028497 on `00c7435` passed lint, unit tests, and production build. P21.2 workflow run 39247028479 passed unit tests, typecheck, and build; its protected runtime-integrity certification steps were skipped for pull-request events. P21.1 and other current-head workflow results must be inspected separately; workflow success alone does not imply runtime certification.
- The authoritative V2 history contract is evidenced by `supabase/verification_v2/pie_p5/verify_0060.sql`, which asserts `session_mode = 'adaptive'`; the current history projection does not supply the separate config mode required to identify Normal MCQ vs Nudge. This is a real source-contract limitation, not a reason to relabel `adaptive`.
- No schema/migration, production data, auth/RLS or PIE inference formula was changed. PR #168 remains open and unmerged.
