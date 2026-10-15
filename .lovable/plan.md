# Practice Page Revamp — Phase 1 Audit and Plan

Scope: Practice page visuals and front-end flow only. No backend, schema, inference, homepage or Performance Intelligence changes.

## 1. Component and data-flow map (verified)

```text
/practice (protected) -> src/pages/Practice.tsx  default Practice()
  phase: setup | drill | results | history | review   (local state, ?resume=<id> jumps to drill)
  setup   -> SetupScreen            (same file, ~640 lines)
               loads: V2 subjects, subtopics, get_practice_question_metadata (paged),
                      own attempt history (status counts)
               -> onStart(config {mode, topics, subtopics, questionCount, statusFilter})
  drill   -> components/practice/PieDrillSession.tsx
               start: pie_create_session(p_count 1..50)  -> get_practice_session_questions
               next : pie_next_question (server picks)
               save : save_attempt (server grades; confidence required; duplicate-safe)
               finish: complete_practice_session -> results; then best-effort
                       refresh_candidate_intelligence + rebuild_candidate_state
               resume pointer: active_sessions row in the app's own backend
  results -> ResultsScreen (same file, ~500 lines)
  history -> components/history/MCQHistory ; review -> MCQReviewQueue
```

## 2. Findings for each control

Verified in code:

- **MCQ Drill: With option change** (`recharge`). The answer can be changed until you move on; the change sequence is sent to `save_attempt`. Works.
- **MCQ Drill: Without option change** (`no-change`). **The lock is enforced only in the browser.** The server rejects changes only when the session's settings say `answer_change_mode = 'locked'`, but the session is created with a question count only, so the server never sees the lock. The rule exists on the server but isn't connected.
- **Full Mock Exam.**
  - The 210-minute timer is in the browser only.
  - The Back button is disabled; answers lock in the browser only.
  - **It is capped at 50 questions** (both the browser and the server limit sessions to 50). The setup screen says the 150-question exam isn't available, but the card still sets a 150 count, which is then cut to 50.
  - **No exam blueprint is used.** It's the same adaptive selection as the drill. Ending also works the same way: the drill finishes when time runs out or at the last question. There's no separate exam-style scoring.
- **Nudge.** **It's a link to /intelligence with a "Coming soon" badge.** No learning-objective selection exists anywhere in the app or the database functions; searching for "nudge" only finds unrelated notification code. Nothing exists yet to preserve.
- **Subject and subtopic filters, status filter, question-load presets.** They are collected, but **`startPieSession` ignores them**: it sends only the count. The page itself says "Topic filters are used for browsing only." The "Select at least one subject or subtopic" check still blocks Start, which is misleading. The `?focus=` "Targeted practice" banner suggests targeting that doesn't happen.
- **Confidence.** A rating from 1 to 5 is required; "Select your confidence level to continue." is shown; a failed save doesn't advance. The server also rejects answers without confidence. Works.
- **Rule-out.** Can be switched on and off; you can't rule out the selected answer, and ruling out blocks choosing that option. Events go to `save_attempt` in the answer's details (`rule_out_events`, `ruled_out_final`). Works.
  - The results page has its own, separate rule-out ("eliminate") toggles. Those are only on screen and not saved.
- **Progress and feedback.** "Question X of N" and the timer are shown. There's no feedback until results, by design.
- **Loading, empty and error states.** Setup has a loading placeholder, an error card with Retry, and a history-error notice. The drill has a loading placeholder and a "Practice could not start" card that sends you back with a full page reload. "No eligible questions" is handled. Resume fails clearly; it never quietly starts a fresh session.
- **Visual leftovers.** The intro tooltip still talks about "Recharge mode" and "No Change mode". There are hard-coded colours in many places (for example `bg-[#081224]`, `text-slate-400`), and two "New Drill" buttons trigger a full page reload.
- **Intelligence boundaries.** The page never reads the shadow model. Readiness is refreshed only after a session completes, and that refresh currently fails on the server for every candidate (the summary issue reported earlier, awaiting your approval).
- **Tests.** The session code and the PIE pipeline have unit tests (6 test files touch Practice/PIE). **There are no tests of the Practice page itself.**

Assumptions (not verified): that the server's adaptive selection ranks questions by evidence (I read its contract, not its code), and that the hosted preview behaves the same as local.

## 3. Proposed layout and flow

```text
Header: Practice  ·  [Review Queue] [History]
Mode selector (3 large tiles, one selected; stacked on phones)
  [ MCQ Drill ]       [ Nudge ]             [ Full Mock Exam ]
Panel for selected mode
  MCQ Drill  : answer behaviour (segmented: With change | No change)
               question load presets + stepper (1-50)
               Topics: read-only "browse" list with counts, clearly marked
                       "does not limit this drill" (no Start blocker)
               [Start drill]
  Nudge      : honest "Not available yet" state, explains what it will do,
               link "See your next step" -> /intelligence. No start button.
  Full Mock  : rules card: 50 questions (current limit), 210-minute timer,
               answers lock, no going back; [Start mock]
Drill screen (focused):
  slim top bar: mode · Question X of N · progress bar · timer
  question stem (max 70ch, comfortable line height)
  options: large tap targets, rule-out toggle on the left (44px)
  confidence: 5-step segmented control, inline required message
  sticky bottom bar on phones: Back (drill only) · Next / Finish
Mock screen: same as drill with Back hidden, a stronger timer,
             and a confirm dialog before Finish.
```

- Visual direction: the Performance Intelligence look (navy, cyan, deep teal, fine borders, light glass), using existing tokens only; hard-coded colours become tokens. Motion stays Framer Motion with reduced-motion respected. No new libraries.

## 4. Files proposed for modification

- `src/pages/Practice.tsx`: replace `SetupScreen` markup with the mode selector and panels, remove the misleading Start blocker and tooltip copy, and swap the page reloads for in-app navigation. `ResultsScreen` gets a restyle only: its logic and the results-only rule-out stay as they are.
- `src/components/practice/PieDrillSession.tsx`: restyle the session screen (top bar, options, confidence control, sticky navigation, mock finish confirmation). **No change to how answers are started, saved or finished.**
- `src/components/practice/PracticeModeSelector.tsx`: new, presentational only.
- `src/index.css`: small page-scoped helpers only if tokens don't cover them.
- `src/pages/Practice.test.tsx` or `src/components/practice/PieDrillSession.test.tsx`: new tests (see 6).

## 5. Risks

- **Question selection:** none if the call to start a session stays unchanged. Removing the topic "blocker" changes nothing on the server.
- **Session progression:** the restyle touches the buttons that save and advance, so the save-before-advance order and the confidence gate must be kept exactly.
- **Telemetry:** the option and rule-out buttons carry the timing and rule-out events. Their handlers must stay byte-identical.
- **PIE and readiness:** untouched. Completion still triggers the same refresh calls.
- **Misleading claims:** "No option change" and "Full Mock" are enforced only in the browser. The plan words them accurately ("locked on this device") and does not claim server enforcement.

## 6. Regression tests and verification

New unit tests:

1. Can't advance without confidence, and the inline message appears.
2. A failed save keeps the current question and its selections.
3. No-change and mock modes ignore a second option click; with-change mode records the sequence.
4. Rule-out blocks selecting that option and can be undone; the selected option can't be ruled out.
5. Mock hides Back and asks for confirmation on Finish.
6. Nudge has no start control.
7. Start sends only the count, with no topic filter (documents the current contract).

Then run the full test suite, the type check and the production build. Browser checks at 390, 768 and 1440 px: no sideways scrolling, keyboard order and reduced motion. A signed-in run of one drill (starting a session and saving answers) writes to live data, so it needs your approval, as reported earlier.

## 7. Decisions needed

1. **Nudge:** no learning-objective selection exists to preserve. Show an honest "not available yet" tile (recommended), or hide Nudge until it's built? Building it needs a new server function, which is outside this task.
2. **Topic filters:** keep them as a browse-only list (recommended), or remove them from setup until the server can use them?
3. **Server-side lock for "No option change" and Full Mock:** this needs a server change (passing the lock into the session), outside this task. Approve as a separate follow-up?
4. **Full Mock:** keep it at the current 50-question limit with clear labelling (recommended), or hide it until a blueprint-based mode exists?
5. **Signed-in end-to-end drill test:** allowed on live data with a test account, or skipped until a separate test environment exists?
