# PIE Intelligence Forensic Audit Execution Log

Last updated: 2026-10-19
Repository: DR-G2/zyntrahealthcareintelligence-com
Working PR: #168, Fix PIE Intelligence evidence gates and mode isolation
Branch: fix/pie-intelligence-evidence-gates
Inspected HEAD: 01ea340a722246ccf9d87ece927f91578715bd3a
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
- 13 files changed; branch HEAD at inspection: 01ea340a722246ccf9d87ece927f91578715bd3a.
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
| P7 Behaviour | BLOCKED / FIX REQUIRED | analyze-behavior combines MCQ + OSCE + Trust Your Gut, emits AMC score predictions, and uses zero defaults for missing timing/changes/accuracy. Must isolate MCQ behavioural analysis and suppress unsupported score/pass predictions without schema changes. |
| P8 Trust Your Gut | PARTIAL | Mode filtering and null-safe denominators added; verify query provenance, answer sequence consistency, category and session calculations. |
| P9 Security/provenance | NOT VERIFIED | Client-side checks do not prove server authorization. Review edge function auth, own-candidate data boundaries and admin guard. |
| P10 Public claims | PARTIAL | Metadata copy revised to avoid readiness claims; inspect all feature cards/status declarations and route promises. |
| P11 Regression | PARTIAL | Zyntra CI #1551 green; runtime cert steps skipped on PR; comprehensive matrix and security tests not yet proven. |
| P12 Handoff | NOT STARTED | Do not merge/release until exit criteria and authorized runtime verification are met. |

## Immediate next action
Continue P7 first, in sequence. Inspect the complete analyze-behavior function and its consumer/schema contracts. The AI prompt currently combines MCQ, OSCE, and Trust Your Gut and asks for an AMC score prediction. Correct the backend contract so OSCE is not mixed into MCQ behaviour and no unsupported AMC score/pass prediction is generated or presented. Preserve descriptive MCQ behaviour patterns and existing protected access controls. Do not alter database schema or PIE inference formulas. Add focused tests, run CI, and record exact results before moving to P8.

## Resume protocol
On resumption, fetch this file and the live PR metadata/HEAD again before editing. Confirm no newer commits supersede this checkpoint. Update this log after each phase with exact files, commit SHA, test command/run ID and observed result. Never mark PASS without evidence.
