# Genjutsu: controlled four-page UI redesign

## 1. Current implementation audit

**Baseline:** revision `ca1c95c2991aa0354f213d9ab4a1457de98f9b30`; application working tree was clean. Scope is Practice, OSCE, Study Plan and AI Lab—not Flashcards, Home or Performance Intelligence.

**Practice — `/practice`:** `src/pages/Practice.tsx` owns setup, results, history and review; `PieDrillSession.tsx` owns active questions. Subjects, subtopics, question metadata and candidate attempt history are fetched from existing V2 contracts. Selection, confidence, rule-out and save-before-advance are connected to `save_attempt`; the server determines correctness. Completion uses `complete_practice_session`; resume uses existing session state. Counts and question progress are derived from these records/state, not decorative metrics. Topics/status are explicitly browse-only: session creation sends a count, not those filters. Nudge cannot start. Mock is capped at 50, with a 210-minute browser timer and hidden Back navigation; answer locks are browser-enforced. No verified full-mock blueprint support. Loading/start failures and retries exist; history has error handling, but review does not distinguish a failed read from an empty queue.

**OSCE — `/practice/osce`:** the actual routed implementation is `src/pages/PracticeOsce.tsx`, a not-live notice and email interest form inserting into `contact_submissions`. No active station, timer, voice, checklist, assessment or feedback workflow is mounted here. Legacy station components exist but all former station routes redirect to this notice. Restyling must not reactivate those components or imply station availability.

**Study Plan — `/plan`:** the actual page is `src/pages/Plan.tsx`, not the unrouted `StudyPlan.tsx`. It reads `readiness_dna`, `subject_dna` and `study_plans` through the existing client. Cached focus areas and weekly schedule come from saved plan JSON; exam horizon and monthly generation lock are derived from dates. Generation calls `generate-study-plan`, which saves the plan. Current/Generate New tabs, access gating and monthly lock exist. There are no task completion, editing, progress-status or overdue fields/handlers. Schedule days are labels, not confirmed dated tasks. Initial read errors are ignored; missing scores become zero, and absent focus areas can produce a formula-based priority list. Links to `/practice?subject=...` navigate but do not enforce that subject in session selection. These limits must remain explicit.

**AI Lab — `/practice/ai-lab`:** `src/pages/AILab.tsx` invokes `ai-lab`, not `v2-ai-lab`. Connected workflows: provider status/connect/disconnect, returned model selection, optional bounded training context (default off), Ask My Performance, Generate Questions, Weak Area Drill, output interactions and recent session metadata. Models/results/history are returned by the API; answer selections and running state are local. History is a list, not a reopen-results action. Status/history errors are swallowed. Displayed output model uses mutable current selection, so it can mislabel an earlier result. No token/cost/validation dashboard is wired. Source shows authenticated-user ownership checks and server-side AES-GCM key encryption, but **not admin-only authorization**.

**Browser observations actually executed:** restored the supplied signed-in preview session and opened all four routes at 1440, 768 and 390px. No horizontal overflow on the inspected initial states. OSCE displayed its unavailable notice; Plan displayed no active plan and its generation view; AI Lab displayed connection/setup and history sections. A second read-only pass found no page runtime exceptions, but visitor tracking requests returned 403. This unrelated failure is not part of the redesign. No sessions, plans, interest submissions or AI runs were created. These checks do not certify all states or server security.

## 2. Page-by-page layout and interaction plan

### Practice: training cockpit
- Use an unframed title/action row instead of a decorative header card; retain History and Review access.
- Keep three distinctive, keyboard-operable mode choices. MCQ Drill exposes answer behaviour and 1–50 question load first; browse-only topics/status become secondary disclosure without suggesting selection support.
- Nudge retains its honest unavailable state and real Intelligence link, with no Start action.
- Mock shows the actual 50-question limit, 210-minute browser timer and no-back rule; no blueprint claim.
- Active questions get a stable top progress/timer row, readable question/options, separate reversible rule-out controls, explicit confidence and a stable mobile save/advance area. Preserve handlers, timestamps, retries, timer and finish confirmation.
- Results prioritize persisted outcome and explanation, with secondary behaviour detail disclosed on demand. Remove no workflow; never promote unsaved results-page rule-out toggles into telemetry.

### OSCE: current availability surface
- Give the not-live state a calm, clear composition with the existing interest form and a genuine MCQ navigation action.
- Add a persistent email label, accessible submission feedback and existing saving/disabled states.
- Do not create an encounter workspace, station preview, timer, scores or examiner feedback. An active encounter room is a separate functionality project.

### Study Plan: navigation map
- Preserve Current/Generate New navigation, access gating and generation limits.
- When a valid saved plan exists, lead with its first priority, labelled as a plan priority—not a fabricated “today” task. Show saved weekly day labels in their supplied order as a chronological list, with all provided topic/focus content readable.
- Do not add completion, in-progress or overdue badges without supporting fields. Do not invent dates or reorder ambiguous day labels as actual dates.
- Keep plan generation/configuration visually separate from the current schedule. Move genuine performance context below the next action; show unavailable values rather than zero for missing evidence.
- Add explicit failed-read/retry and invalid-plan states using the same existing reads, with no fallback schedule. Display formula-derived priorities only with clear provenance, never as a saved schedule.
- Preserve real Practice and Flashcards links; do not imply a subject-targeted drill where the API cannot enforce it.

### AI Lab: research chamber—blocked pending security resolution
- Once admin-only enforcement is independently approved and verified, use a compact connection/configuration area, a dominant workflow/output workspace and a secondary history list.
- Preserve all existing providers/modes, returned model choices, encryption flow, default-off context and separate event logging. Never switch to the unused V2 function as a styling shortcut.
- Display connection/loading/failure states explicitly; distinguish failed history from no history. Show the model captured for the displayed run, not a later changed selection; do not add fabricated usage/cost/confidence metrics.
- Keep AI output visibly experimental and non-authoritative. Existing generated answers/explanations remain experimental, not production-bank content.
- Do not implement this page as “secure admin-only” while the current API accepts ordinary authenticated callers. No authorization changes belong in this visual package.

## 3. Exact expected file scope

**Shared presentation:**
- `src/index.css`: add a four-route-scoped semantic theme, HSL equivalents of the specified palette, surface/focus/motion tokens. Do not replace root or homepage/PIE tokens.
- `src/components/layout/AppLayout.tsx`: apply that theme only on `/practice`, `/practice/osce`, `/plan`, `/practice/ai-lab`; refine existing tabs/header and remove decorative background effects only there.
- `src/components/AppSidebar.tsx`: scoped presentation and mobile keyboard/focus refinements; retain existing links, role checks and logout behaviour.
- `src/components/RoomHeader.tsx`: opt-in compact heading variant for these pages; preserve other consumers' appearance and interface compatibility.

**Practice:** `src/pages/Practice.tsx`, `src/components/practice/PracticeModeSelector.tsx`, `src/components/practice/PieDrillSession.tsx`, `src/components/practice/QuestionExplanation.tsx`, `src/components/history/MCQHistory.tsx`, `src/components/history/MCQReviewQueue.tsx`—markup/accessibility/state presentation only, no selection or scoring changes.

**Other pages:** `src/pages/PracticeOsce.tsx`, `src/pages/Plan.tsx`, and—only after the security blocker clears—`src/pages/AILab.tsx`.

**Tests:** extend `src/components/practice/PieDrillSession.test.tsx`; add focused workflow tests next to `Practice.tsx`, `PracticeOsce.tsx`, `Plan.tsx` and `AILab.tsx` as those stages are implemented. Test rules and outcomes, not copy, CSS or snapshots.

No planned changes to routes in `App.tsx`, auth/client configuration, API adapters, functions, migrations, bank content, Home, PIE or legacy station pages. No new UI or animation packages. Structural decisions, if introduced after approval, will be recorded in `AGENTS.md`.

## 4. Shared components to reuse or refine

Reuse `AppLayout`, `AppSidebar`, `BrandMark`, `RoomHeader`, and the existing Button, Input, Label, Select, RadioGroup, Tabs, Badge, Switch, Progress, AlertDialog, Popover and Collapsible primitives. Keep Plus Jakarta Sans body and established heading typography. Prefer native/accessible radio navigation over manually incomplete radio semantics. Preserve SecurityOverlay, UpgradePrompt, SubscriptionTimer and all handlers. Avoid a new generic dashboard template or a duplicate design system; use scoped semantic roles and opt-in shared treatments. Keep sections unframed and use subtle surfaces only for genuinely framed workspaces/repeated items.

## 5. Known functionality and security risks

- **Admin-only AI Lab gap:** route uses generic `ProtectedRoute`; both AI functions use `requireUser`, not admin authorization. Source ownership filters do not meet the required admin-only policy. Existing RLS migration definitions do not prove deployed enforcement. Live ordinary-user denial and key isolation have not been tested in this audit. Separate approval is required for any route/API authorization repair; hiding a tab is not a fix.
- **Study Plan integrity:** ignored load errors and zero defaults can misrepresent missing data. Frontend state presentation can be repaired within scope, but no source switch, readiness recalculation or schedule invention is authorized. Its generation API also lacks a verified server entitlement check in source; flag separately rather than modifying it.
- **Practice integrity:** no-change locks/timer are browser-side; filters are browse-only; Nudge is unavailable. Preserve these limits and do not accidentally imply authoritative enforcement.
- **Explanation provenance:** `QuestionExplanation.tsx` contains generic named-textbook reference templates, not question-specific citations. Do not present these as verified sources; clarify provenance without editing question content. Bookmark/note writes also lack checked error results; any correction beyond error presentation requires separate scope review.
- **Accessibility:** OSCE email lacks an associated label; Practice answer-behaviour custom radios lack arrow navigation; mobile sidebar needs focus/escape review. Small slate text, excessive uppercase labels, header cards and glows reduce clarity.
- **Cross-page blast radius:** shell/header changes can affect Home/PIE/Flashcards indirectly. Route-scoped tokens and opt-in variants must be verified on those pages without redesigning them.
- **Telemetry regression:** preserve AI Lab event deduplication refs and Practice save payloads exactly; timed logic must remain independent of transitions.

## 6. Test and acceptance checklist

**Executed now:** existing `PieDrillSession.test.tsx` and `pie-practice-client.test.ts`: **16/16 tests passed**. Signed-in initial rendering inspected at all three requested widths, including screenshots. No build/typecheck/full-suite run is claimed for this audit; no application changes have been made.

**After approval, stages and acceptance:**
1. Shared tokens/shell: only the four routes gain the new treatment; logo/routes remain unchanged, focus/touch navigation works, no visual leakage to Home/PIE/Flashcards.
2. Practice: replay confidence, save failure/retry, reversible rule-out, answer-change/no-change, resume, 50-question cap, 210-minute timer, no-back and finish-confirmation tests; confirm no answer keys before authorized submission.
3. OSCE: interest submission success/failure via mocked API; no active-station controls or invented assessment.
4. Plan: valid/empty/malformed/failed read, missing metrics, generation failure/success, monthly lock and navigation tests; no fabricated dates/status or silently generated schedule.
5. AI Lab after security clearance: connect/status/disconnect, returned models, context off/on, run failure/output/history and event deduplication tests; real admin/non-admin direct-route/API and ownership checks in an authorized isolated environment.
6. Cross-page: relevant tests/full regressions, available lint, harness build/typecheck results, 1440/768/390 screenshots, overflow/dialog checks, keyboard/focus/labels, contrast, reduced motion, console/network and request-contract comparison.

Use mocked/intercepted requests for deterministic state coverage. Real persistence tests need a separate test backend or explicit permission: starting a drill, generating a plan or invoking AI writes records and may incur provider costs. Automated tests alone do not establish release readiness.

## 7. Blockers and approval boundaries

- Approve this UI plan before implementation. Earlier approvals do not apply.
- AI Lab cannot pass its mandatory admin-only security gate under the current source contract. Request separate authorization work, or hold the AI Lab implementation stage; no security weakening or backend change is included here.
- Current OSCE has no encounter capability; current Plan has no dated task/progress/editing model; Nudge cannot start; full mock has no verified dedicated blueprint. Visual work will not invent these capabilities.
- Live deployed RLS, function authorization, candidate isolation and full persisted workflows remain unverified here. Existing migration files and static ownership checks are evidence, not live certification.
- The preview uses live services; isolated write testing is not available from the supplied preview session alone. No credentials or provider keys are requested for this audit.

**Stopped after audit and plan. No application code edits, commits, merges, production migrations, record changes, publication or deployment. Implementation remains subject to explicit approval; security and persistence gates remain open.**