# Zyntra Genjutsu: Performance Intelligence revamp

**Status: planning only.** Scope is `/intelligence` and its necessary supporting presentation/read adapters. No new inference engine, production data changes, migrations, commits, merges or deployments are authorised by this plan.

## 1. Current-state audit

Repository inspected at `d826c16` on workspace branch `edit/edt-224402a8-a528-4a65-baa2-b187a85da221`; working tree was clean. This is not verified as GitHub main. Findings below are source-verified, not live deployment or account-isolation certification.

| File / evidence | Finding | Risk | Proposed correction |
|---|---|---|---|
| `PerformanceIntelligenceV2.tsx:176–177,196–216` | “PIE Capability State” falls back to legacy `snapshot.readiness` when PIE is not ready; attempt count is from another source. | Legacy readiness appears to be canonical PIE capability; insufficient evidence can look conclusive. | Display capability only from valid PIE. Keep Readiness DNA distinct and unchanged; never substitute it. |
| Same page `573–585,700–708`; `lib/supabase.ts:1–2` | PIE/history use V2, but accuracy, stability, timing and confidence use the managed legacy client. | Counts and scores can refer to different datasets and time windows. | Validate existing V2 learner projections; bind each signal to its own verified source and denominator. |
| Same page `225–226,705`; V2 migration `0029:20–24,64–66` | UI labels `time_management` as average seconds; the inspected V2 producer writes a normalised timing score ×100, not seconds. | Unit mismatch if that score is used; live legacy field meaning remains unverified. | Timing Control uses verified PIE timing; average seconds, if shown, uses non-null history durations separately. |
| Same page `593,677–693,700–705` | Query errors are discarded; missing data is coerced to zero or empty arrays. | Unavailable becomes “no evidence” or genuine 0%. | Independent loading/error/empty states; validate payloads and preserve missing values. |
| `pie-state.ts:76–79,105–129` | Missing dimension estimates become 0; model label is literal `v2-candidate-state`; one global evidence count covers six dimensions. | False deficits, invented metadata and exaggerated dimension reliability. | Preserve nulls in a compatible presentation adapter; omit unsupported metadata; do not invent dimension counts. Shared contract changes require regression checks. |
| Page `189,573–575`; `P13ShadowInferencePanel.tsx:54–59,96–113` | Learner page loads shadow diagnostics including source-state version, model and inference hash; “certified” claims are static. | Internal details enter the ordinary candidate experience. | Remove learner shadow request and panel; preserve authorised diagnostics independently. Do not claim certification from copy. |
| `pie-p14-shadow-read/index.ts:60–74,111–115,140–195` | Source authenticates and scopes to caller, but has no admin-role check; it returns diagnostic metadata and may refresh/store a projection. | UI removal alone cannot establish an admin-only endpoint. | Separate approval gate for server-side admin authorisation and minimal diagnostic payload; verify actual deployed endpoint and inference entry points before changing them. |
| Page `307–322,630–663` | Local thresholds create interpretation; weighted frontend heuristics rank “Priority Areas.” These are derived, not random dummy values. | Presentation competes with authoritative recommendations and exposes scoring rules. | Remove local ranking/conclusive diagnosis; use existing authorised action evidence, or descriptive observations with no recommendation claim. |
| Page `440–450,465–471,613–619` | Subjects are not actionable; “Act on this signal” only opens generic Practice; chart gives 0% a minimum-height bar; small trend windows may overlap. | Implied targeting and visual trend distortion. | Subject selection opens evidence detail. Practice CTA explicitly opens setup, not a claimed targeted session; zero stays zero and comparisons require disjoint evidence windows. |
| Page `273–277,330–340` | Model/sequence metadata is duplicated; no presentation freshness check. | Clutter and stale state presented as current. | Safe evidence disclosure: count, window and timestamp only; show age without inventing a staleness threshold. |
| Page `116–150,190–193,736–754`; global CSS/Tailwind | Raw colours, oversized nested cards, decorative blobs and raw buttons bypass existing semantic tokens/components. | Inconsistent contrast, theming and mobile clarity. | Token-based cyan/teal palette, unframed sections, repeated tiles ≤8px radius, existing Button/Tooltip/Accordion patterns. |

No random/synthetic series was found in the inspected performance tab: recent accuracy bars derive from history. Their denominators and presentation still need correction. Behaviour/Trust Your Gut tabs need a focused source/runtime check before surfacing their insights in the new overview. No claim is made that live RLS, provider calls or analytics are certified.

## 2. Proposed page architecture

**Direction:** near-black navy, electric cyan/deep teal, restrained translucent surfaces and fine luminous borders, Space Grotesk headings/Plus Jakarta Sans body. Scientific immersion, not crimson/anime styling. Reuse semantic HSL tokens; any additional tokens are page-scoped to avoid restyling unrelated pages. No fake telemetry, decorative orbs or simulated “live inference.”

**Desktop**
```text
Performance Intelligence                         Evidence status / updated
                   Compact neural anatomy
                             │
Clinical Accuracy | Decision Stability | Timing Control | Confidence Alignment
                             │
               Six-dimensional PIE map + accessible values
               Evidence-backed interpretation
Subject evidence                 Behaviour / confidence insights
                             │
                       Next Best Action
                   Expandable evidence transparency
```

The continuous brain → spinal pathway → action motif connects these sections visually, without representing an actual inference pipeline. Use an inspectable custom anatomical/vector illustration with a static reduced-motion version; no new 3D stack. Neural shapes are decorative and never encode invented scores. The six-axis map shows existing valid dimensions only, paired with readable values; missing axes are explicitly unavailable, not 0.

**Tablet/mobile:** single-column pathway; 2×2 primary signals; compact map above its accessible values; subject list before insights and action. Keep the hero short so signal tiles begin within the first screen. No sticky block obscuring content. Minimum 44px targets, wrapping labels and no horizontal overflow at 360px. Desktop uses a constrained unframed layout, not cards containing cards.

**Interactions:** select a signal/dimension to open its plain-language evidence detail; select a subject to expand its actual history; evidence disclosure is keyboard-operable. Preserve Performance/Behaviour/Trust Your Gut URLs and tab access. The overview may summarise verified existing insights, but does not rebuild or trigger a new analysis engine.

## 3. Component and file map — technical details

| File/component | Planned treatment |
|---|---|
| `src/pages/PerformanceIntelligenceV2.tsx` | Keep route orchestration/tab compatibility; replace overview layout; remove shadow load, readiness substitution and local priority ranking. |
| New `src/components/intelligence/` | Small page-scoped NeuralPathway, PrimarySignals, PieDimensionMap, SubjectEvidence, IntelligenceInsights, NextAction and EvidenceDisclosure components. No global UI duplication. |
| New page-scoped read/presentation adapter in `src/lib/pie/` | Validated per-source statuses, denominators, units and safe metadata; no writes, inference or scoring. |
| `pie-state.ts` and its tests | Only necessary null/metadata compatibility fixes, after checking all consumers; preserve existing inference/read contracts and practice sync. |
| `pie-history-client.ts`, V2 client/config/auth bridge | Reuse existing authorised readers/session setup unchanged. Prefer minimal projections; do not display answer keys in intelligence evidence. |
| AppLayout, RoomHeader, Button, Tooltip, Accordion; existing typography/tokens | Reuse. Header can use a page-only variant if necessary; no shared redesign. |
| BehaviourProfile / TrustYourGut | Preserve standalone tab behaviour; reuse only verified read-based insights. No unrelated refactor. |
| P13 panel / admin PIE inspection | Remove from learner overview, not delete internal capability. Relocation only if an authorised admin read path is verified. |
| Global tokens, AGENTS.md, roadmap | After approval: page-scoped token additions if needed, record structural rules and scoped task tracking. |
| Edge Functions / SQL / deployment | Outside visual implementation approval. Admin-only endpoint hardening needs separate justified approval; no schema change proposed. |

## 4. Metric-to-source matrix

| Display | Current source / calculation | Canonical display plan / failure behaviour |
|---|---|---|
| Clinical Accuracy | Legacy `readiness_dna.clinical_accuracy`; count from V2 history | Caller-owned V2 history correctness: correct/eligible recorded attempts ×100; declare returned sample/window. Prefer verified existing aggregate if complete history is required. Missing read ≠ 0%. |
| Decision Stability | Legacy `answer_stability` | Existing verified V2 `my_readiness.dimensions.answer_stability`, percent, with its own evidence window. Do not penalise every answer change via a new formula. No verified denominator → unavailable. |
| Timing Control | Legacy `time_management` shown as seconds | Existing `my_pie_state.state.timing.estimate` ×100, gated by valid evidence. Optional mean response seconds is separately labelled from valid history durations. |
| Confidence Alignment | Legacy `get_confidence_intelligence` scores confidence 1–5 against outcomes (`20261006100000:47–75`) | Existing V2 `my_confidence_intelligence.calibration_score` ×100, validated units/evidence. Confidence-rated history count is distinct from total attempts. Missing confidence → building/no data; failure → unavailable. |
| Capability, Decision, Timing, Calibration, Sustained Performance, Learning | `loadPieEngineView` → `loadPieView` → `my_pie_state`; each dimension's `estimate` ×100 | Preserve this non-shadow PIE source; validate finite [0,1], missing stays missing. Current adapter gates ready at ≥6 global observations and non-INSUFFICIENT evidence; do not treat this as per-dimension proof. |
| Subject performance / trend | V2 `get_my_attempt_history`; correct counts by subject, recent blocks | Keep authorised history, expose sample/window/count; avoid overlapping comparisons and fabricated calendar trends. |
| Interpretation / Next Best Action | Frontend thresholds and priority score; separate `NextBestStep` uses legacy RPC | Validate existing V2 `my_next_best_actions` (`0043:17–19`) and its action data. Show supplied evidence/action only. If unavailable, say no recommendation and offer generic Practice setup; no invented LO targeting. |

`0044` defines a caller-scoped SECURITY DEFINER reader behind `my_pie_state` and ownership checks for rebuild. This is repository evidence, not proof of live grants. Readiness DNA remains separate and authoritative for readiness; shadow output never controls recommendations, readiness or selection. Do not change model formulas or evidence thresholds.

## 5. Privacy and company-secret safeguards

- Stop fetching shadow output on ordinary `/intelligence`, not CSS hiding. Never place hashes, state IDs, formulas, internal model metadata, raw observations, schema names or credentials in learner DOM, tooltips, console output or error copy.
- Preserve auth route guard (`App.tsx:138`), V2 session bridge, caller-scoped reads, RLS, session ownership and answer-key boundaries. UI guards are not authorisation.
- Before declaring privacy complete, verify live ordinary-user/anonymous/other-candidate requests against all diagnostic endpoints. Source shows P14 lacks admin authorisation; server hardening is a separately approved security dependency, not silently included in a page redesign.
- Existing loaders can rebuild candidate state and P14 can store projections. Therefore planning will not open the authenticated page or invoke these loaders: that could violate the no-production-writes constraint. Implementation QA uses isolated accounts/environment.
- Transparency exposes only user-meaningful evidence coverage, timestamp/window, missing inputs and limitations. No psychological labels, pass guarantees, official AMC claims or unverified certification.

## 6. Testing and acceptance matrix

All tests below are planned, **not run or passed** in this planning phase.

| Case | Expected / pass criterion | Verification |
|---|---|---|
| New candidate, zero attempts | No fake scores/trends; clear evidence-building state and generic practice action | Fixture unit/component test; isolated signed-in browser |
| Insufficient PIE evidence | No legacy capability substitution or confident diagnosis | PIE state + presentation tests |
| Sufficient evidence | Four signals and six dimensions match source values, units and denominators | Concrete payload assertions and isolated browser readback |
| Missing confidence | No fabricated calibration or 0-score conclusion | Nullable/missing-confidence fixtures |
| Missing subject history | Honest empty section; unrelated data remains visible | History adapter/component tests |
| PIE/read failure | Distinct unavailable state with safe retry; history can remain usable | Mock failed read and browser network failure |
| Stale/inconsistent state | Timestamp/age visible; malformed dimensions never become zero or reliable conclusions | Fixed-clock/invalid-contract tests; compare persisted state |
| Auth expiry | No previous candidate values remain; existing login recovery preserved | Browser expiry/sign-out checks |
| Cross-candidate/diagnostic access | User A cannot obtain B's records; ordinary user cannot read admin diagnostics | Real negative API/RLS tests in isolated environment; blocks privacy sign-off if failing |
| Mobile/reduced motion | No overlap/overflow at 360/390/768/1280px; 44px targets, keyboard focus, static pathway | Playwright screenshots, keyboard checks, reduced-motion context |
| Navigation/persistence regression | Tabs/aliases preserved; Practice opens honestly; answer, confidence and rule-out persistence unchanged | Isolated drill end-to-end and existing practice/history suites |
| Regression/build | Relevant suites and full suite pass; preview reports build OK; no unrelated diff | `bunx vitest run` scoped/full; harness type/build results (do not manually duplicate harness builds) |

Update existing boundary tests that require learner shadow loading (`p14-read-path-boundary.test.ts:22`) to assert the new learner/admin separation, while retaining ownership and shadow-isolation coverage. No snapshot-only acceptance or passing claims based solely on compilation.

## 7. Execution order and dependencies

1. Approval; confirm intended source revision and isolate QA environment. Recheck existing live read contracts/grants read-only; do not invoke rebuild loaders against production.
2. Correct verified source/units/null/error issues and remove learner diagnostic retrieval. Escalate server authorisation separately if needed.
3. Build page-scoped components and approved neural pathway; connect verified read-only sources.
4. Add interactions, accessible evidence details and responsive/reduced-motion states.
5. Run matrix, relevant regression suites and signed-in isolated end-to-end flows; review visual/data/security evidence and scope of diff.
6. Report actual files, commands/results, blockers, rollback (revert scoped frontend change), GitHub/PR availability and release status. No automatic merge or publication.

## 8. Risks, unresolved questions and complexity

- **Reference:** the available screenshot inspected is the existing intelligence/shadow panel, not the requested homepage anatomy reference. Current `Home.tsx:96–122` has a brain icon, not a spinal-cord pathway. Use your written direction now; supply the intended homepage screenshot before final visual sign-off if exact matching is required.
- **Data dependency:** V2 projection availability, live units, aggregate windows, freshness rules and action payload/navigation support need read-only verification. No claimed topic-specific action until Practice actually supports it.
- **Security dependency:** admin-only diagnostic authorisation cannot be achieved securely by frontend changes alone. Completion of privacy acceptance may require separately approved function changes.
- **QA dependency:** isolated authenticated candidates/non-production environment must be available before tests that rebuild state or submit attempts.
- **Complexity:** medium–high: bounded page redesign plus mixed-source integrity fixes and security verification. Visual work can proceed independently of an unresolved backend issue, but cannot be reported as full functional/privacy completion.

## 9. Confirmation

Only this plan document has been created. No application code, roadmap, memory, database, runtime state, commits, merges, migrations or deployments have been changed. No browser/API runtime tests have been claimed. Implementation awaits explicit approval.