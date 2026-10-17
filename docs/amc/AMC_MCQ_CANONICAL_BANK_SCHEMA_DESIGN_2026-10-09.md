# AMC MCQ Canonical Question-Bank Schema Design

Date: 2026-10-09  
Status: DESIGN PROPOSAL, NOT A MIGRATION  
Scope: AMC MCQ v1 and exam-neutral PIE integration. AMC Clinical/OSCE is deferred.  
Repository baseline: PR #81 branch `docs/amc-mcq-content-pie-contract`  
Live inspection: active Supabase V2 project on 2026-10-09.

## 1. Decision

Use one canonical relational content model with **stable question identity + immutable question versions + normalized stable option identity**.

- `public.questions` remains the compatibility identity/serving boundary during staged migration. It is not allowed to remain an independently edited content source after cutover.
- `public.question_content_versions` becomes the authoritative authored-content record for each version.
- `public.question_content_version_options` stores five options as relational rows with stable option IDs, a display key (A-E), and position. Answer correctness references the option UUID, not option text or array position.
- A question version is immutable after it enters review. A published version is immutable permanently. Any clinically meaningful change creates a new version row and a new review decision.
- Delivery, session-question records, attempts, answer-key evaluation, explanation release, PIE observations, and question-level intelligence must identify the exact content version.
- AMC plugin metadata stays in the AMC adapter schema. PIE inference/state remains exam-neutral and does not own clinical content or AMC blueprint rules.

Do not replace or rename the live `public.questions` table in the first migration. Too many deployed RPCs, foreign keys, import paths and PIE selectors currently depend on it. Use an additive, compatibility-first migration and only switch readers after the backfill and parity checks pass.

## 2. Evidence this design addresses

Read-only live inspection found:

- 225 active rows in `public.questions`.
- All 225 option arrays have five entries but no stable option IDs; existing options are primitive values.
- 123 of 396 attempts have `question_version IS NULL`.
- 781 session-question rows currently join to a question row, but there is no exact content-version reference on those rows.
- 225 rows in `pie.question_lo`, but zero rows in `amc.amc_lo_taxonomy`, `amc.amc_blueprint_lo`, and `amc.amc_question_context`.
- The active `amc-intelligence` Edge Function reads legacy-shaped `public.amc_plugin_version`, `public.amc_exam_environment_v1`, and `public.amc_blueprint`, while a parallel `amc.*` schema exists.

These are design inputs, not permission to rewrite production data.

## 3. Relational model

### 3.1 Stable identity

Keep `public.questions.id` as the stable question UUID for existing foreign keys. Treat `zyntra_id` as the stable human/import identifier and enforce uniqueness after a duplicate audit. Identity-level fields remain minimal: stable UUID, stable external ID, lifecycle status, current published version pointer (introduced only after backfill), and audit timestamps.

Legacy columns (`stem`, `options`, `correct_answer`, `explanation`, integer `version`, `provenance`) are compatibility fields only during migration. After cutover, application/importer writes to them must be prohibited. Do not drop them until all consumers are migrated and rollback requirements have expired.

### 3.2 `public.question_content_versions`

One row per immutable authored version:

- `id uuid primary key`: immutable content-version identity.
- `question_id uuid not null references public.questions(id)`.
- `version_number integer not null check (version_number > 0)`; unique with `question_id`.
- `content_hash text not null`: SHA-256 of canonicalized authored content; unique with question/version.
- `format text not null`: initially `single_best_answer`.
- `stem jsonb not null`: structured text, lead-in and media references.
- `answer_option_id uuid not null`: stable option UUID, never option position or display letter.
- `explanation jsonb not null`: validated structured explanation (section 5).
- `clinical_metadata jsonb not null`: structured task, population, acuity, care setting and editorial tags.
- `provenance jsonb not null`: source records and source versions; not learner telemetry.
- `editorial_difficulty text`, `review_state text not null`, `created_by uuid`, `created_at timestamptz`, `reviewed_by uuid`, `reviewed_at timestamptz`, `published_at timestamptz`, `retired_at timestamptz`.
- Optional `supersedes_version_id uuid` to record lineage; if used, enforce that it belongs to the same stable question.
- Check constraints for allowed format and lifecycle state. Review-state transitions must be enforced by a controlled RPC/trigger, not arbitrary learner writes.

The `answer_option_id` uses a composite foreign key `(id, answer_option_id)` to the options table `(question_version_id, option_id)`. Add the constraint after both tables exist and make it `DEFERRABLE INITIALLY DEFERRED` so a version and its options can be created in one transaction. A deferred FK guarantees the answer key identifies an option in that exact version.

### 3.3 `public.question_content_version_options`

One row per option in one content version:

- `question_version_id uuid not null references public.question_content_versions(id)`.
- `option_id uuid not null`: stable UUID for this option in this version.
- `option_key text not null check (option_key in ('A','B','C','D','E'))`.
- `position smallint not null check (position between 1 and 5)`.
- `option_text text not null`.
- Primary key `(question_version_id, option_id)`.
- Unique `(question_version_id, option_key)` and `(question_version_id, position)`.

For AMC single-best-answer v1, publish validation must prove exactly five options, keys A-E exactly once, positions 1-5 exactly once, unique option UUIDs, nonblank text, and one answer key referencing an option in that version. A deferred constraint trigger or publish RPC must enforce the five-row count, since ordinary CHECK constraints cannot count sibling rows.

Option IDs are stable within a content version. When an item is revised, retain the option UUID only for the same semantic option; a rewritten or materially different option gets a new UUID. The display key/position can change without changing semantic identity, but any answer-key change requires a new content version and review.

### 3.4 Published version pointer

Add `public.questions.current_published_version_id uuid` only after version backfill. The pointer must reference a version belonging to that same question. Use a composite FK to enforce same-question ownership, or a trigger if the chosen FK layout cannot express it cleanly. A controlled publish RPC updates the pointer atomically after all validation gates pass. Draft/review versions must never be selected by learner RPCs.

Avoid storing a second mutable `is_published` truth on both identity and version rows. The authoritative publish pointer plus version lifecycle is the source of truth; any compatibility status is derived or synchronized by the controlled publish transaction.

### 3.5 Session delivery and attempt identity

Add `question_version_id uuid` to:

- `public.practice_session_questions`: required for all newly served questions; immutable once served.
- `public.user_attempts`: required for all new attempts and must equal the exact version attached to the corresponding session-question row.
- `pie.pie_observation`: explicit version reference, or at minimum a validated immutable `content_version_id` in the observation's structured provenance. Prefer a relational column and FK where operationally feasible.
- `intelligence.question_dna` and its history: add a version UUID/hash reference while retaining the integer version only as a compatibility field until downstream readers are moved.

Keep the stable `question_id` for aggregation across versions. New composite constraints must ensure the version belongs to that question and, for a session attempt, that the submitted version matches the version served. Do not infer the historical version from the current published pointer.

Legacy attempts with null version are **unknown-version historical data**. Do not backfill them to the current version and pretend that is historical truth. Mark them as legacy/unresolved in a separate migration/audit field or leave the version null with explicit provenance. Report them separately in analysis.

### 3.6 AMC metadata and PIE learning objectives

- `amc.amc_question_context` must reference the immutable version ID, not only the stable question ID, because a revision can change task type, patient group or blueprint eligibility.
- `amc.amc_blueprint` and `amc.amc_blueprint_lo` remain the AMC adapter's versioned blueprint contract. Populate only from a reviewed, source-versioned AMC blueprint manifest.
- `pie.question_lo` currently maps stable question IDs to exam-neutral learning objectives. During transition, preserve it as the compatibility mapping consumed by existing selectors. Introduce a version-specific mapping (for example, `pie.question_version_lo`) before permitting versions to change the primary LO or concepts.
- PIE stays exam-neutral. The AMC adapter supplies eligible question-version candidates and blueprint constraints through a controlled interface; it must not place AMC-specific posterior logic inside core PIE tables.
- The current zero-row AMC taxonomy/context mappings are a launch blocker for claiming full blueprint coverage, not a reason to manufacture tags from subject names.

## 4. Canonical content lifecycle

```text
DRAFT
  -> STRUCTURE_VALIDATED
  -> CLINICAL_REVIEW
  -> APPROVED
  -> PUBLISHED
  -> RETIRED (a later version supersedes it; historical attempts remain readable)
```

- Reject publication if any required content, option, answer key, explanation, source, taxonomy, reviewer or blueprint requirement is missing.
- Never edit a published version. A change creates a new version and restarts validation/review.
- Retiring a version prevents future selection but never removes it from historical session/attempt views.
- Quarantine is a serving decision with an auditable reason, actor, timestamp and release/review path; do not silently delete or rewrite content.
- Import jobs create draft versions and validation reports. They cannot directly publish, modify the current published pointer, or update the live legacy content columns.
- Use idempotency keys on imports (source batch + stable item ID + content hash) to prevent duplicates. Same hash is a no-op; changed hash creates a new draft version, never an in-place update.

## 5. Structured explanation contract

The version's `explanation` must validate these fields:

- `summary`: why the keyed option is best in this specific vignette.
- `key_clues[]`: clinical clue and its decision significance.
- `decision_steps[]`: concise, auditable clinical decision sequence; not hidden chain-of-thought.
- `option_analysis[]`: exactly one entry for each of the five option IDs; each has `option_id`, `verdict`, and a specific scenario-linked `why`. The keyed option is marked correct; the other four are marked incorrect/less appropriate.
- `clinical_pearl`: transferable learning point.
- `common_trap`: plausible misconception or decision error.
- `when_answer_changes`: optional but required when a nearby clinical finding would materially alter management.
- `guideline_context`: where clinically applicable, Australian source authority/title, URL, publication/version date, accessed date and exact recommendation context.
- `review_notes`: editorial note and uncertainty/variation when relevant; not exposed as a learner-facing field unless approved.

No generic distractor explanations, unsupported source claims, invented references, or answer-key ambiguity. Medical editorial approval is mandatory before publication.

## 6. API and security contract

Learner delivery returns only: stable question ID, content-version ID/hash, stem, ordered option IDs/keys/text, allowed media, and safe taxonomy fields.

Before submission, do not return the correct option ID/key, explanation JSON, hidden provenance/reviewer notes, answer analytics, PIE internal state, candidate posteriors, model parameters or other users' data.

Submission sends selected option ID plus permitted telemetry. Server code loads the exact served version, verifies the selected option belongs to that version, derives correctness against that version's answer option, and persists the version ID. Ignore/reject any client-supplied correctness, answer key, explanation, question version override or PIE state.

Results API releases the correct option and approved explanation only after the attempt is persisted and the owning session's completion/review policy permits release. RLS and RPC authorization must scope every read/write to the authenticated owner; privileged service-role operations must remain server-only. Test direct table access as well as RPC payloads.

PIE observations must record stable question ID, immutable version ID/hash, attempt ID, observation schema version and provenance. A failure to emit telemetry/inference must not change the saved answer or correctness result.

## 7. Migration sequence (design only)

**M0 — Reconciliation, no writes**
1. Compare deployed migration history with repository migration files and live definitions.
2. Identify all readers/writers: importer, learner pool, fixed/adaptive selector, session delivery, submit/save RPC, results/history RPC, AMC adapter, PIE question DNA and observation pipeline.
3. Snapshot counts and integrity reports for questions, versions, options, sessions, attempts, PIE observations, question-LO mappings, and AMC context.
4. Resolve the canonical AMC metadata table ownership before changing runtime reads.

**M1 — Additive schema, disposable/test database first**
1. Create version and normalized-option tables, lifecycle enum/checks, hash constraints, and validation/publish functions.
2. Add nullable version IDs to session/attempt/observation/question-DNA records; do not make required until backfill/parity gates pass.
3. Add strict grants/RLS and service-only publish/import RPCs. Learners must not query answer keys or explanations from raw version tables.
4. Add unit/SQL tests for constraints and cross-owner access.

**M2 — Backfill and parity**
1. Convert each current active row into a draft version in a staging/test database.
2. Convert each legacy primitive option into a stable UUID option, preserve its current display order, map the existing answer label/text unambiguously, and compute canonical content hash.
3. If key-to-option mapping is ambiguous, quarantine the row; do not guess.
4. Validate every converted explanation against all five options and source/review requirements. Existing plain-text explanations may be retained as draft source material, but are not automatically considered complete.
5. Produce row-by-row parity report for stem, ordered options, key, explanation, taxonomy and provenance. No live cutover on aggregate counts alone.

**M3 — Dual-read shadow validation, no dual-write content**
1. Use version-table reads in a test environment and compare payloads against current practice RPCs.
2. Verify question selection, ordering, key withholding, answer scoring, completion results, session resume, history, and PIE events.
3. Keep old runtime authoritative until all checks pass. Do not allow two independently writable content copies.

**M4 — Controlled cutover (separately approved)**
1. Publish only reviewed versions and update the current-version pointer through the publish RPC.
2. Switch delivery/submit/results/selector/AMC adapter to exact version IDs in a coordinated release.
3. Require version IDs for new sessions and attempts; reject any attempt whose version differs from the served session row.
4. Monitor version mismatches, key/explanation leaks, selector rejection reasons, failed attempts and PIE observation parity.
5. Rollback means switching runtime to the old compatible reader only if data integrity is preserved; it must not rewrite published versions or retroactively assign unknown historical versions.

**M5 — Deprecation, only after evidence**
1. Remove legacy content writes first.
2. Keep legacy columns/read adapters until all clients and reports have migrated and the rollback window has expired.
3. Drop redundant legacy fields only in a later separately reviewed migration with verified dependency inventory.

## 8. Required acceptance gates

- [ ] Each stable question ID has unique monotonically increasing version numbers.
- [ ] Published content hashes are stable; attempted edits to a published version fail.
- [ ] Each AMC v1 version has exactly five options, unique option IDs, unique A-E keys and positions 1-5.
- [ ] Answer option FK points to an option in the same version.
- [ ] New session-question rows and attempts reference the exact immutable version.
- [ ] Submit cannot override correctness or select an option from a different version.
- [ ] Historical null-version attempts remain explicitly unresolved.
- [ ] Pre-answer delivery and raw learner table access expose neither answer key nor explanation.
- [ ] Results release is owner-scoped and follows completion policy.
- [ ] PIE observation version/hash matches the attempt and delivered version; telemetry failure cannot fail submission.
- [ ] AMC version context and blueprint eligibility are populated from an approved source-versioned manifest.
- [ ] Duplicate/hash/idempotency tests pass; importer cannot overwrite or auto-publish.
- [ ] All RLS tests pass for two users, anon, authenticated, and privileged service path.
- [ ] Blueprint coverage and clinical source/reviewer completeness reports pass.
- [ ] Independent item analysis and readiness validation remain separate gates; no pass-probability claims without empirical calibration.

## 9. Explicit non-goals for this step

- No production migration or DDL execution.
- No data backfill, import, update, quarantine or publication.
- No Edge Function changes or deployment.
- No PR merge or traffic cutover.
- No readiness probability activation.
- No AMC Clinical/OSCE content or plugin scope expansion.

## 10. Step 3 disposition

**DESIGN COMPLETE; IMPLEMENTATION NOT STARTED.** This document establishes the proposed canonical model and staged path. Before writing migrations, complete M0 reconciliation of migration history and runtime consumers, then implement and test the additive schema in a disposable database.
