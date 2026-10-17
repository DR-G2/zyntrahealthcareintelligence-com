# AMC MCQ Question Bank and PIE Integration Contract

Status: PROPOSED IMPLEMENTATION CONTRACT
Scope: AMC MCQ v1 only. AMC Clinical/OSCE remains a later plugin.
Principle: one exam-neutral PIE core, exam-specific AMC adapter, versioned clinical content.

## Decisions

1. Keep canonical question content separate from question intelligence. `public.questions` owns authored content and version; `intelligence.question_dna` owns derived question behaviour; `amc.amc_question_context` owns AMC-specific mappings. Never put PIE posterior/state fields inside question JSON or AMC metadata.
2. Store immutable question versions. Editing a clinically meaningful stem, option, key, or explanation creates a new content version and re-review. Attempts reference the exact version shown.
3. Use stable option IDs, not option text or array position, as answer identity. A question has one best answer for standard single-best-answer MCQs. Validate exactly five options for the AMC CAT environment.
4. Separate authored evidence from learner telemetry. Correctness is server-derived from the key for the version presented. Learner submissions cannot write correctness, question DNA, confidence calibration, or readiness.
5. Treat readiness as an evidence-qualified engineering index until empirical validation is complete. No pass probability, AMC score equivalence, or causal intervention claims before the appropriate certification gate passes.

## Canonical question content contract

Suggested versioned content shape:

```json
{
  "zyntra_id": "AMC-MED-000001",
  "content_version": 1,
  "status": "draft",
  "format": "single_best_answer",
  "stem": {
    "text": "Clinical vignette...",
    "media": [],
    "lead_in": "What is the most appropriate next step?"
  },
  "options": [
    {"id": "A", "text": "Option A"},
    {"id": "B", "text": "Option B"},
    {"id": "C", "text": "Option C"},
    {"id": "D", "text": "Option D"},
    {"id": "E", "text": "Option E"}
  ],
  "answer_key": {"option_id": "C"},
  "explanation": {
    "summary": "The best answer is C because...",
    "key_clues": [{"clue": "Finding", "significance": "Why it matters"}],
    "reasoning_steps": ["Step 1", "Step 2"],
    "option_analysis": [
      {"option_id": "A", "verdict": "incorrect", "why": "Why it is less appropriate"}
    ],
    "clinical_pearl": "Transferable rule",
    "common_trap": "Likely reasoning error",
    "when_answer_changes": "What finding would change the choice"
  },
  "clinical_metadata": {
    "primary_domain": "Adult Medicine",
    "subject": "Cardiology",
    "subtopic": "Acute coronary syndrome",
    "patient_group": "ADULT_MEDICINE",
    "task_type": "diagnosis_or_management",
    "presentation": [],
    "setting": "Australian clinical practice",
    "difficulty_editorial": "moderate",
    "cognitive_demand": "application"
  },
  "provenance": {
    "sources": [{"title": "Guideline title", "url": "https://...", "publisher": "Authority", "version": "version/date", "accessed_at": "YYYY-MM-DD"}],
    "author_id": "uuid",
    "reviewer_id": "uuid",
    "reviewed_at": "timestamp",
    "evidence_status": "review_required"
  }
}
```

This is the content contract, not a mandate to store the entire document in one JSONB column. Keep queryable IDs, status, version, subject/subtopic, key, timestamps and ownership in relational columns. Use JSONB for structured stem details, options, explanation sections, media, and provenance where appropriate. Do not expose `answer_key` or full explanations in the question-delivery payload before submission.

## Required explanation standard

Every published item must include:
- Why the keyed answer is best, tied to decisive clinical clues.
- A short reasoning chain showing the clinical decision, not hidden chain-of-thought.
- A specific explanation for every distractor, including why it is less appropriate in this scenario.
- Australian practice context with cited, current source/version when management depends on a guideline.
- A common trap or misconception.
- A concise transferable clinical pearl.
- A conditional note on which changed finding would alter the answer when clinically useful.

No generic “other options are incorrect”, unsupported guideline claims, invented citations, or ambiguous answer keys. Explain uncertainty if authoritative guidance varies. Medical editorial review is required before publication.

## AMC blueprint and item taxonomy

Map every published item to one primary AMC patient group and a detailed internal subject/subtopic taxonomy:
- Adult Medicine: 30%
- Adult Surgery: 20%
- Women's Health: 12.5%
- Child Health: 12.5%
- Mental Health: 12.5%
- Population Health: 12.5%

Preserve exact proportions in blueprint logic; do not independently round group counts in a way that changes a 150-item total. Use the official AMC source/version manifest as the authority and re-version the adapter when the specification changes. Internal subjects are finer-grained tags, not replacements for the six AMC patient groups.

Required item tags: primary patient group, subject, subtopic, clinical presentation, task/decision type, cognitive demand, care setting, acuity, age group, source evidence level, difficulty editorial estimate, question family, content version, reviewer status, and AMC blueprint version. Optional secondary tags must not make an item count toward multiple primary blueprint buckets.

## PIE separation and data flow

```
Authored/versioned question + AMC metadata
             |
             v
Authenticated practice delivery (key/explanation withheld)
             |
             v
Server-validated answer submission
             |
             +--> immutable attempt + response telemetry
             |
             +--> exam-neutral PIE observation pipeline
                         |
                         +--> candidate state
                         +--> behaviour evidence
                         +--> question DNA by question version
                         +--> uncertainty / data-quality checks
             |
             v
AMC adapter: blueprint + environment + safe readiness DTO
             |
             v
Next-best practice action (only within enabled/certified scope)
```

PIE is the only owner of exam-neutral inference and decision logic. AMC owns exam blueprint, environment, task taxonomy and the interpretation layer. Do not create a separate AMC learner model or duplicate PIE weights.

### Separate the following concepts

- Editorial difficulty: human estimate used for authoring and content balancing.
- Observed difficulty: inferred from learner responses and stored in question DNA.
- Discrimination: inferred from response data only when sample size/quality permits.
- Ambiguity/defect: editorial reports and response anomalies; defects can quarantine an item.
- Candidate capability, decision, timing, calibration, sustained performance, learning: PIE dimensions, with uncertainty and evidence provenance.
- AMC readiness: AMC-conditioned summary from PIE plus the selected AMC environment; not an independently invented probability.

Low sample size must yield insufficient evidence, not fabricated precision. Question DNA must be version-specific and updated through the governed inference pipeline, never by client-side writes. A defective or disputed question must be excluded from readiness and flagged for review.

## Attempt telemetry contract

Capture only signals with a defined purpose and consent/retention policy:
- candidate/user ID, session ID, question ID and exact content version
- selected option ID; server-derived correctness
- presented/submitted timestamps and elapsed time
- confidence rating if explicitly collected
- answer changes and event sequence if the interface supports them
- question position and session mode
- event schema version, client/app version and provenance

Keep event ingestion append-only. Validate sequence/timestamps server-side. Do not block authoritative answer persistence if PIE is unavailable. Do not infer psychological traits from a single response. Confidence is a separate observation, not correctness. Missing data must be represented as missing, not zero.

## Publishing lifecycle

`DRAFT -> EDITORIAL_REVIEW -> CLINICAL_REVIEW -> APPROVED -> PUBLISHED -> RETIRED`

Additional states: `QUARANTINED`, `REJECTED`. Only approved/published versions can enter candidate practice. Any key change or clinically meaningful correction creates a new version, invalidates affected caches, and retains historical attempt linkage. Quarantined items are removed from new sessions pending review; historical attempts remain auditable.

## Initial MCQ scope

- Question authoring/import, versioning, editorial and clinical review.
- Six-group blueprint coverage and subject/subtopic coverage report.
- Safe question delivery with answer key and explanation withheld until submission.
- Server-authoritative scoring and immutable attempt history.
- Full post-answer explanation and review mode.
- Bookmarks/notes and targeted review of incorrect/low-confidence items.
- PIE telemetry, question DNA and candidate state integration with fail-safe boundaries.
- AMC-specific readiness DTO and next-best action, with probability disabled pending empirical calibration.
- Admin audit trail, source/version manifest, item quarantine and content-quality reporting.

## Certification gates and remaining work

### Engineering/content gate
- [ ] Verify live V2 migrations, table columns, RLS, RPCs and edge functions against this contract.
- [ ] Confirm canonical question schema supports immutable versions and attempt-to-version linkage.
- [ ] Confirm the delivery API never leaks key, explanation, or internal PIE/AMC tables.
- [ ] Add automated schema/content validators and fixtures for exactly five stable option IDs, one key, complete distractor analysis, provenance, blueprint mapping and lifecycle status.
- [ ] Test answer persistence, duplicate submissions, session completion, history, review and question-version consistency.
- [ ] Verify PIE telemetry failure never blocks answer persistence.
- [ ] Run cross-user RLS/security tests and a live end-to-end MCQ flow.
- [ ] Verify all current content has valid sources, reviewer approval and no template leakage.

### Measurement/scientific gate
- [ ] Approve a privacy-reviewed, anonymised response-matrix export with documented consent, provenance and de-identification.
- [ ] Check sample adequacy and item exposure; exclude duplicates, defective items and ineligible attempts.
- [ ] Run independent IRT/item-analysis cross-check with a documented tool/version and reproducible outputs.
- [ ] Pre-register metrics and acceptance criteria for item parameters, uncertainty, calibration, discrimination and subgroup/DIF checks where sample size permits.
- [ ] Run empirical validation with candidate-level separation and an untouched holdout set.
- [ ] Record validation metrics, limitations, dataset version/hash and reviewer decision.
- [ ] Pass AMC P8 Gate 1 before evaluating Gate 2 decision validity.
- [ ] Keep readiness probability null until a calibrated model passes independent validation and formal promotion approval.
- [ ] Keep intervention efficacy claims disabled until outcomes and causal/intervention validation support P8 Gate 3.

### Product/content scale gate
- [ ] Audit all live questions for correctness, clinical currency, difficulty, duplication, image rights and explanation completeness.
- [ ] Build coverage report against blueprint and detailed taxonomy.
- [ ] Establish item-writing and clinical-review throughput before scaling toward 3,000 items.
- [ ] Add post-publication defect reporting, quarantine SLA, correction/version audit and re-review cadence.

## Release rules

- This document is a proposed contract, not proof that the implementation already conforms.
- Do not run production database writes, apply migrations, activate models, merge, or deploy as part of documenting this decision.
- Do not claim AMC endorsement, score equivalence, validated pass prediction, or proven intervention efficacy.
- AMC Clinical/OSCE is out of scope for this first plugin release.
