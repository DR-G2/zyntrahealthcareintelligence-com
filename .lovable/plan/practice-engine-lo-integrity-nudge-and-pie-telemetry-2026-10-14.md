# Practice Engine, LO Integrity, Nudge and PIE Telemetry

Work runs in small, checkable steps. Each step ends with tests, typecheck and build. No production data changes, no deploys, no mapping bulk-updates without your approval.

## What is already confirmed
- Practice drills run through `PieDrillSession` (280 lines) on the V2 backend; questions are served by V2 practice sessions and saved via the server `save_attempt` function, which already decides correctness server-side.
- Confidence (1-5) exists but is optional: the drill sends `null` when not picked.
- The drill's finish handler expects ruled-out options, but no rule-out controls are currently rendered in the drill.
- `save_attempt` already records answer-change sequence and writes PIE observations, and rejects inactive questions and sessions the candidate does not own.

## Step 1 - Baseline audit (read-only)
- Trace one question end to end on V2: session creation, serving, answer, change, confidence, save, telemetry, LO state rebuild, Nudge.
- Question-to-LO mapping audit: list questions with no, invalid, duplicate or retired-only mappings; confirm which LO key/code columns exist.
- Record current test results. Deliver a short audit report before any schema change.

## Step 2 - LO identity safeguards
- One shared resolver: question UUID to LO UUID via the canonical mapping table only; clear errors on missing/ambiguous mappings, no fallback LO.
- Tests: question UUID passed as LO UUID is rejected; multiple mappings follow primary semantics; retired questions excluded from new sessions, history kept.

## Step 3 - Mandatory confidence (UI + server)
- Submit blocked with inline "Select your confidence level to continue."; selections kept on error; no advance if saving fails; safe retry with no duplicate attempts.
- Server: `save_attempt` rejects missing confidence for new sessions (new migration, existing function replaced in place).

## Step 4 - Rule-out restored
- Accessible rule-out toggle on each option, reversible, visually distinct from selection; a ruled-out option cannot be submitted until un-ruled.
- Rule-out events and final ruled-out set saved separately from answer changes (stored in attempt provenance/telemetry payload if the schema has room; otherwise a small additive column, proposed first).

## Step 5 - Answer-change filter
- New drill setting next to Subject: "Free choice (default)", "Allow changes", "Lock first answer". Explained in plain words so it is not confused with history.
- Stored in the session settings; the server rejects a locked-mode attempt whose change sequence shows more than one selection.

## Step 6 - Drill vs Nudge separation
- Drill: question-centric, filters only.
- Nudge: picks a target LO from authoritative evidence, then resolves to eligible questions; shows the reason; reports "no eligible question" instead of switching LO.
- Session source (drill/nudge) saved in session settings; tests for each policy.

## Step 7 - PIE wiring checks
- Verify every signal lands with the right question and LO IDs; failed telemetry never creates learning state; shadow inference stays admin-only and never feeds Readiness DNA, Nudge or selection (tests assert this).

## Step 8 - Practice page layout
- Clear landing: MCQ Drill, Recommended (Nudge), Resume. Only working options shown. Mobile-first, existing dark visual style, loading/empty/error states.

## Step 9 - Checks and report
- Full test suite, typecheck, build, security scan, and a signed-in browser run of one drill and one Nudge session on desktop and mobile.
- Final report with real results, files changed and rollback notes. Changes sync to GitHub; I cannot open a pull request from here, so that link will not be provided.

## Technical notes
- Migrations are additive only; `save_attempt` signature kept backward compatible.
- V2 migrations are applied to the V2 project via the existing connection, after your approval of the SQL.
- Answer key never leaves the server; rule-out and confidence responses carry no correctness.
