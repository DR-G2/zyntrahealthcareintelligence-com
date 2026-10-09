# AMC MCQ + PIE Contract Audit

Date: 2026-10-09
Scope: static source audit of repository `main` at `373cd71ca4dbe4a7b961ace1e5ceb0022420d168` against `docs/amc/AMC_MCQ_QUESTION_BANK_PIE_CONTRACT.md`.
Status: PARTIAL SOURCE AUDIT. This is not a live database certification. No database was queried or modified; no migration, merge, or deployment was performed.

## Summary

The repository already has useful foundations: server-side correctness derivation in `public.save_attempt`, learner-safe practice RPCs that withhold the answer key and explanation before completion, version-specific `intelligence.question_dna`, AMC blueprint metadata, PIE telemetry, and a post-answer results RPC restricted to completed sessions and answered questions.

The current implementation does **not yet satisfy the complete proposed content contract**. The main gaps are immutable content versioning, stable option identity, structured explanation validation, clear canonical-bank/import boundaries, and final live verification of deployed schema/API behavior.

## Findings

### F-01 — Question versions are labels, not immutable content records
Severity: HIGH
Evidence:
- `supabase/migrations_v2/0004_content.sql` stores stem, options, key and explanation on one `public.questions` row with an integer `version`.
- `public.user_attempts` stores `question_id` and a nullable `question_version`, but there is no content-version foreign key linking the attempt to a frozen stem/options/key/explanation snapshot.
- `supabase/functions/import-questions/index.ts` upserts rows with a matching `zyntra_id`, updating content in place.
Impact: an edited item can change what historical attempts appear to refer to; version metadata alone does not preserve the exact content shown.
Required: introduce an immutable question-version record (or equivalent immutable version table), make the stable question identity point to a published version, and require attempts/session-question rows to reference the exact version. Re-imports must create a new draft/version, never silently overwrite a published item.

### F-02 — Option identity is not guaranteed to be stable
Severity: HIGH
Evidence:
- The V2 schema stores `options jsonb` and `correct_answer text`, with no database-enforced option-ID structure.
- Existing bank verification includes checks for answer labels A-E and array length, indicating label/position-based answer conventions are in use.
Impact: reordering or editing options can change the meaning of an answer label unless option identity and key mapping are governed together.
Required: use immutable option IDs and key the correct answer by option ID. Validate exactly five unique option IDs for the AMC CAT delivery environment; reject missing, duplicate or dangling IDs.

### F-03 — Explanation content has no enforced completeness contract
Severity: HIGH
Evidence:
- `supabase/migrations_v2/0004_content.sql` defines `explanation text`.
- The import function accepts `explanation` as plain text and also accepts some legacy-style fields such as `incorrect_answer_explanations`, without requiring a complete five-option analysis, evidence provenance, reviewer state or source version.
Impact: the database/import boundary cannot ensure each published item has a defensible explanation for every distractor or current clinical sourcing.
Required: define a structured explanation schema and validate all five option analyses, decisive clues, concise rationale, clinical pearl/trap where relevant, source/version/access date and reviewer approval before publication. Do not require hidden chain-of-thought.

### F-04 — Import path appears tied to the legacy question shape
Severity: HIGH
Evidence:
- `supabase/functions/import-questions/index.ts` writes fields such as `question_text`, `category`, `difficulty` and `tags`.
- The V2 canonical schema in `supabase/migrations_v2/0004_content.sql` uses `stem`, `subject_id`, `subtopic_id`, `difficulty_tier`, `version` and `provenance`.
Impact: the importer and the proposed V2 canonical model do not share an explicit adapter/contract. This creates risk that content is imported into a legacy table while PIE practice reads the V2 table.
Required: trace production import calls and table targets, select one canonical bank, and implement a validated adapter into that schema. Do not change runtime traffic until this mapping is proven with fixtures.

### F-05 — Blueprint metadata exists, but end-to-end coverage is not yet certified
Severity: MEDIUM
Evidence:
- `supabase/migrations_v2/0027_amc_v2_baseline_configuration.sql` defines the six AMC V8 group proportions, 150 items and 210 minutes.
- PIE candidate selection uses AMC blueprint eligibility and learning-objective mapping.
Impact: configuration and selection logic existing in source do not prove the published bank has valid primary group tags or meets distribution and source-version requirements.
Required: produce a reproducible report counting only approved/published versions, with exactly one primary AMC group per item, subject/subtopic coverage, duplicates, review status and blueprint version. Preserve exact proportions in the 150-item allocation logic.

### F-06 — PIE question DNA is version-aware, but source-version linkage needs completion
Severity: MEDIUM
Evidence:
- `supabase/migrations_v2/0007_intelligence_core.sql` defines `intelligence.question_dna` unique on `(question_id, question_version)`.
- Attempts carry an integer `question_version`, but the question content is not frozen by that version.
Impact: the intelligence key can distinguish version numbers without being able to retrieve the exact historical content that generated an observation.
Required: tie question DNA, session delivery and attempts to an immutable content-version ID/hash; record the content and model versions in observation provenance. Preserve missing telemetry as missing.

### F-07 — Pre-answer answer-key/explanation withholding has defensive controls in source
Status: SOURCE EVIDENCE FOUND; live state not verified
Evidence:
- `supabase/migrations_v2/0055_pie_p5_f1_question_key_columns.sql` revokes learner column access to `correct_answer` and `explanation`, and rebuilds `questions_for_learner` with a NULL explanation.
- `supabase/migrations_v2/0053_pie_p3_peek_farm_fixes.sql` limits `get_practice_session_results` to completed sessions and returns key/explanation only for answered questions.
- `scripts/pie-live-certification.mts` contains checks for key and explanation absence from the session-question payload.
Caveat: source and test existence do not prove these exact definitions/grants are active in the current production database. Run the existing live certification after the schema/API audit is ready.

### F-08 — Correctness is server-derived in the later V2 save RPC
Status: SOURCE EVIDENCE FOUND
Evidence:
- `supabase/migrations_v2/0040_harden_practice_attempt_boundary.sql` and `0065_pie_p2_authoritative_save_attempt.sql` look up the answer key server-side and compute correctness from the submitted answer; the supplied `p_is_correct` parameter is not used to determine the stored result.
- PIE observation and learner-state rebuild failures are handled in separate exception blocks after attempt insertion.
Caveat: confirm the deployed function signature/body and execute live adversarial tests; static source is not live proof.

## Recommended order of remediation

1. Confirm the deployed schema, grants, function definitions and runtime table targets using read-only inspection.
2. Decide and document the single canonical bank and importer adapter. Do not import or write data yet.
3. Design immutable content-version and stable-option-ID schema with attempt/session foreign-key linkage.
4. Define structured explanation/provenance/review validation and lifecycle gates.
5. Add migration-local tests for publish/version immutability, answer-key isolation, five unique options, full distractor analysis, and exact attempt-version linkage.
6. Generate the current-bank quality and blueprint coverage report; quarantine defects through an approved, audited path.
7. Run cross-user RLS, session delivery/submission/results and PIE-failure-isolation tests against a disposable test database.
8. Run live read-only schema inspection, then the existing live certification suite only after its preconditions are confirmed.
9. Keep readiness probability disabled until independent empirical validation and formal promotion approval.

## Guardrails

- No production database writes or migrations were performed for this audit.
- No merge or deployment was performed.
- No claims are made here about live production state beyond previously documented source-level evidence.
- AMC Clinical/OSCE remains outside this AMC MCQ v1 audit.

## Step 2 — Live V2 schema audit (2026-10-09)

Status: READ-ONLY INSPECTION COMPLETED against the active Supabase project `zyntra-production` (project ref `hkowvjazuwebmibssdut`). This is live schema evidence, not a security penetration test or end-to-end learner-session certification. No production writes, migrations, merge, or deployment were performed.

### Runtime path confirmed

- Canonical MCQ rows served by practice RPCs are in `public.questions` (225 active rows).
- `public.get_practice_question_pool` and `public.get_practice_session_questions` return `NULL::text` for explanation. `public.get_practice_session_results` only returns answer key/explanation when the owning session has status `completed`.
- `public.save_attempt` computes correctness server-side from `public.questions.correct_answer`; client `p_is_correct` does not determine stored correctness.
- `amc-intelligence` is deployed and active (JWT verification enabled). Its current implementation reads `public.amc_plugin_version`, `public.amc_exam_environment_v1`, and `public.amc_blueprint`, not the corresponding `amc.*` tables.
- `pie-infer-state` is deployed and active (JWT verification enabled); it reads the authenticated user's PIE observations using the service role and writes shadow inference rows. It reports the shadow model as non-authoritative and non-adaptive.

### Live findings

- 225 active questions; no active rows were missing a key, explanation, or exactly five options in the aggregate checks.
- The 225 active option arrays use primitive values rather than option objects with stable `id` fields. All 225 were missing option IDs.
- 396 attempts; 123 attempts have `question_version IS NULL`.
- 781 session-question rows; all 781 currently join to a question row, with zero orphaned references. Session-question rows have no content-version FK/reference.
- 396 PIE observations, equal to the current 396 attempt count. This count match does not prove each observation is semantically valid or that inference quality is certified.
- `pie.question_lo` has 225 rows, but `amc.amc_lo_taxonomy` has 0, `amc.amc_blueprint_lo` has 0, and `amc.amc_question_context` has 0. AMC-specific LO eligibility/context mapping is therefore not populated in the new schema.
- Parallel AMC metadata structures exist: `public.amc_blueprint` has 6 rows, while `amc.amc_blueprint` has 1. The live Edge Function currently reads the former. Canonical ownership and the migration/import target must be decided before changing data paths.
- RLS is enabled on inspected question, attempt, session, PIE, and AMC tables. The `public.questions` policy allows SELECT only for active rows, while column grants inspected do not give `authenticated` direct access to `correct_answer` or `explanation`. Practice RPC execute grants were present for `authenticated` and absent for `anon`.
- Supabase migration history reports repeated entries for several initial migration names, followed by later migrations through `0081_v2_p5_history_rpc_schema_alignment`. Reconcile this history against repository migration files before preparing or applying another migration.

### Step 2 disposition

**PARTIAL PASS for the read-only inspection; NOT READY for canonical-bank remediation or launch certification.** The deployed learner-facing key/explanation boundary has supportive live evidence, but immutable question-version linkage, stable option IDs, and AMC-specific LO/blueprint mappings remain unresolved. The next step should be a source-to-live migration/runtime reconciliation and a canonical-bank decision, still without data writes.
