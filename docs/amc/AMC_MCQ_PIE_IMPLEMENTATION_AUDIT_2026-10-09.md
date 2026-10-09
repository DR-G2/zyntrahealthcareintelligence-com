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
