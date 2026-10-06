# Zyntra V2 Supabase Migration — Phase 2 Architecture

Date: 2026-10-06
Repository: DR-G2/zyntrahealthcareintelligence-com
Phase 1 source: `docs/migration/ZYNTRA_V2_PHASE1_INVENTORY.md`

## 1. Phase 2 objective

Design the clean, portable Supabase/Postgres architecture that will become the canonical Zyntra V2 backend.

This is an architecture definition, not a production migration.

The existing Lovable/Supabase backend remains untouched.

### Non-negotiable rule

**Learning data must never depend on intelligence being available.**

The minimum learner transaction is:

`question -> attempt -> saved`

Everything else is downstream:

`attempt -> telemetry -> intelligence -> PIE -> intervention`

If an intelligence service fails, the attempt remains saved.

---

## 2. V2 architecture layers

V2 is divided into eight logical layers.

### Layer A — Identity
- Supabase Auth
- `profiles`
- `admin_roles`
- legal acceptance

### Layer B — Learning content
- `subjects`
- `subtopics`
- `questions`
- `clinical_stations`
- flashcards
- model/reference content

### Layer C — Learning transactions
- `practice_sessions`
- `station_sessions`
- `user_attempts`
- `station_attempts`
- progress
- bookmarks
- notes
- study plans

### Layer D — Raw learner telemetry
- `behavior_events`
- attempt telemetry
- confidence observations
- session events

Raw telemetry is source data. It must not be overwritten by derived scores.

### Layer E — Intelligence
- question DNA
- behavior DNA
- readiness DNA
- subject DNA
- confidence intelligence
- interventions
- next-best actions

Derived intelligence is recomputable wherever possible.

### Layer F — PIE
PIE is an exam-neutral inference and decision system.

It consumes canonical observations and produces:
- state
- uncertainty
- inference
- validation
- decisions
- provenance
- runtime/certification evidence

PIE must not own the basic attempt transaction.

### Layer G — Exam adapters
The AMC adapter translates exam-specific rules into PIE-compatible context.

AMC-specific assumptions belong here, not inside the exam-neutral candidate state.

### Layer H — Command / operations
- RBAC
- audit
- system health
- errors
- manual overrides
- security controls
- AI Lab
- privileged Edge Functions

---

## 3. Canonical ID strategy

Preserve existing UUIDs during migration wherever possible.

### Primary keys
Use UUID primary keys for user-owned and transactional records.

### Auth identity
`profiles.id` must equal the Supabase Auth user UUID.

### Foreign keys
Use UUID foreign keys rather than email addresses.

Email is an attribute, never an identity key.

### Stable content identifiers
Questions and stations retain their existing UUIDs.

Human-readable Zyntra IDs remain separate:
- `zyntra_id` for questions
- `zyntra_id` for stations

### External migration key

Every migratable domain should support a stable source reference during cutover:

`legacy_id UUID NULL`

This is migration metadata, not a permanent replacement for the V2 primary key.

---

## 4. Core schema

## 4.1 Identity

### profiles
Purpose: learner identity and application profile.

Core fields:
- id UUID PK -> auth.users.id
- email
- display_name
- avatar_url
- country
- timezone
- role/status fields required by the application
- created_at
- updated_at

Do not store authentication secrets here.

### admin_roles
Purpose: Zyntra Command RBAC.

Recommended model:
- id
- user_id -> profiles.id
- role
- active
- created_at
- updated_at

The email should not be the primary authorization key.

Supported command roles remain:
- Heisenberg
- Gus Fring
- Jessi
- Kim Wexler
- Mike Ehrmantraut
- Saul Goodman
- Hank Schrader

Role permissions are defined in code/policy, not inferred from display names.

---

## 4.2 Taxonomy and content

### subjects
Canonical subject taxonomy.

### subtopics
Belongs to a subject.

### questions
Canonical MCQ content.

Core relationship:

`subjects -> subtopics -> questions`

Question content should separate:
- stem
- options
- correct answer
- explanation
- difficulty
- subject/subtopic
- status
- version metadata
- provenance
- Zyntra ID

Question DNA is not embedded into the question row.

### clinical_stations
Canonical OSCE station content.

Station content should separate:
- scenario
- candidate instructions
- examiner instructions
- marking checklist
- timing
- subject
- status
- version/provenance

Generated/session-specific station copies must not be confused with canonical station content.

---

## 5. Learning transaction model

### practice_sessions
Replaces the overloaded historical `active_sessions` concept.

Purpose:
- identify a practice run
- hold session configuration
- current state
- lifecycle

Recommended fields:
- id
- user_id
- session_type
- status
- config JSONB
- started_at
- completed_at
- last_activity_at
- created_at
- updated_at

### practice_session_questions

A normalized session/question mapping.

Purpose:
- preserve question order
- prevent JSON-only session state
- support resumability
- preserve the exact question set

Fields:
- id
- session_id
- question_id
- position
- presented_at
- answered_at
- created_at

### user_attempts

This is the most important transactional table.

One row = one submitted answer.

Core fields:
- id
- user_id
- question_id
- session_id
- selected_answer
- is_correct
- time_taken_seconds
- confidence_level
- answer_changes_count
- time_to_first_click
- change_sequence
- pause_events
- time_of_day
- question_position
- previous_question_correct
- created_at

Optional intelligence snapshots may be stored, but they must never be required to insert the attempt.

### attempt provenance

Every attempt should identify:
- content/question version
- app/session version where needed
- source/migration provenance

This protects historical interpretation when question content changes later.

---

## 6. OSCE transaction model

### station_sessions
One OSCE practice session.

### station_session_items
Normalized station ordering.

### station_attempts
One completed/recorded station attempt.

Separate:
- candidate performance
- timing
- checklist results
- evaluator/AI evaluation
- derived intelligence

Do not put large mutable evaluation structures into a single opaque row unless they are genuinely unstructured.

---

## 7. Raw telemetry

### behavior_events

Raw event stream.

Core fields:
- id
- user_id
- session_id
- question_id nullable
- event_type
- event_version
- occurred_at
- sequence_no
- question_position nullable
- payload JSONB
- created_at

Examples:
- question_viewed
- first_click
- answer_selected
- answer_changed
- pause_started
- pause_ended
- question_submitted
- confidence_recorded
- session_paused
- session_resumed

### Rule

Raw events are append-only.

Do not update old behavioural events to make derived intelligence look better.

If an event definition changes, increment `event_version`.

---

## 8. Question DNA

### question_dna

One canonical derived state per question/version.

It may contain:
- observed difficulty
- discrimination signals
- response distribution
- timing profile
- confidence profile
- stability signals
- trap/ambiguity signals
- DNA version
- source observation window
- updated_at

### question_dna_history

Recommended V2 addition.

Purpose:
- preserve historical DNA states
- make model changes auditable
- allow rollback/comparison

The current state is a cache. History is the evidence trail.

---

## 9. Candidate intelligence

### behavior_dna
Current derived behavioural profile.

### readiness_dna
Current readiness state.

### subject_dna
Per-candidate/per-subject intelligence.

### confidence_intelligence

Confidence should be treated as a first-class derived signal, not merely a UI number.

Inputs include:
- correctness
- confidence
- response time
- answer changes
- hesitation
- question position
- previous-question correctness

Outputs can include:
- calibration
- overconfidence
- underconfidence
- confidence stability
- decision confidence quality

All derived values need:
- model/version
- calculated_at
- evidence window

---

## 10. Ideal candidate model

### ideal_candidate_profile

This is benchmark/configuration data.

It is not learner-readable by default.

Separate:
- benchmark definition
- benchmark version
- dimensions
- weights
- effective dates

Do not expose raw benchmark rows through public learner RLS.

---

## 11. Intervention engine

### intervention_catalog
Global intervention definitions.

### candidate_interventions
A recommendation assigned to one candidate.

### intervention_outcomes
What happened after the recommendation.

### intervention_effectiveness
Aggregated evidence about intervention performance.

### next_best_actions
Current candidate action queue/cache.

The intervention engine consumes intelligence.

It must not modify the source attempt.

---

## 12. PIE V2 design

PIE should be rebuilt as a coherent graph rather than replaying the historical PIE migration sequence.

### 12.1 Model/provenance

- pie_model_version
- pie_observation
- pie_inference_run

### 12.2 Candidate state

- pie_candidate_state
- pie_state_uncertainty
- pie_dynamic_state
- pie_dynamic_observation

### 12.3 Question state

- pie_question_state
- pie_question_uncertainty
- pie_identifiability
- pie_hypothesis
- pie_question_quarantine

### 12.4 Validation

- pie_validation_run
- pie_validation_metric
- pie_validation_claim

### 12.5 Exam environment

- pie_exam_environment
- pie_exam_adapter_snapshot
- pie_exam_readiness

### 12.6 Decision layer

- pie_dwig_candidate
- pie_dwig_selection
- pie_dwig_outcome
- pie_dwig_evaluation
- pie_decision_candidate
- pie_decision
- pie_decision_outcome

### 12.7 Intervention evidence

- pie_intervention_outcome
- pie_intervention_effect_estimate
- pie_intervention_causal_evidence

### 12.8 Runtime and certification

- pie_runtime_decision
- pie_runtime_gate
- pie_shadow_run
- pie_certification_gate

### 12.9 Compatibility

`pie_legacy_compatibility` is temporary only.

It must not become part of the permanent learner data path.

---

## 13. PIE ownership rule

PIE consumes:

`attempts + raw_events + question_state + candidate_state + exam_context`

PIE produces:

`inference + uncertainty + decisions + provenance`

PIE does NOT own:

`answer persistence`

This directly prevents the production failure pattern where an intelligence function can block an answer save.

---

## 14. AMC adapter

The AMC plugin sits above PIE.

### AMC-owned domains
- amc_plugin_version
- amc_blueprint
- amc_task_taxonomy
- amc_question_context
- amc_exam_environment
- amc_adapter_evaluation
- amc_dwig_context
- amc_intervention_catalog
- amc_validation_run
- amc_validation_metric
- amc_validation_claim
- amc_certification_gate

The adapter can interpret:
- AMC blueprint
- AMC difficulty
- AMC station/task context
- AMC readiness rules
- AMC-specific intervention mapping

It must not rewrite exam-neutral PIE state.

---

## 15. RLS security architecture

RLS is part of the schema design, not a final patch.

### Learner-readable

A learner may read:
- own profile
- own sessions
- own attempts
- own progress
- own notes/bookmarks
- own flashcards/reviews
- learner-safe intelligence summaries

### Learner-writeable

A learner may create/update:
- own attempts
- own sessions
- own notes
- own bookmarks
- own learning preferences

### Server/admin only

Never directly expose through learner RLS:
- ideal candidate benchmark definitions
- other candidates' intelligence
- AI training context
- encrypted provider credentials
- admin audit logs
- manual overrides
- certification gates
- security records
- raw model/provenance controls
- service secrets

### Important

Admin access must not mean unrestricted browser access.

Sensitive admin reads/writes should go through controlled server-side functions where practical.

---

## 16. Audit architecture

Every high-risk administrative mutation creates an immutable audit record.

Audit record should contain:
- actor_user_id
- actor_role
- action
- target_type
- target_id
- reason
- before_snapshot where appropriate
- after_snapshot where appropriate
- request/correlation id
- timestamp

Never use an audit log as the source of truth for application state.

---

## 17. Trigger philosophy

V2 will deliberately use fewer database triggers.

### Allowed

Safe infrastructure triggers:
- updated_at maintenance
- immutable audit capture where required
- narrowly scoped integrity constraints

### Avoid

Do not use long trigger chains for:
- readiness calculation
- PIE inference
- question DNA
- behavioural reconstruction
- intervention selection

Those operations belong in explicit server-side jobs/functions.

### Reason

The current production failure showed why hidden trigger dependencies are dangerous.

A database insert should not unexpectedly invoke an intelligence graph capable of rejecting the original learning transaction.

---

## 18. Edge Function contract

Edge Functions are the server-side action boundary.

Each function should have:
1. authentication requirement
2. authorization requirement
3. input schema
4. database operations
5. failure behavior
6. audit behavior where needed
7. response contract

### Failure rule

Functions that enrich learning data must fail independently.

For example:

`save_attempt()` succeeds

then independently:

`emit_behavior_event()`

then independently:

`update_question_dna()`

then independently:

`update_candidate_intelligence()`

then independently:

`run_pie()`

A failure at step 5 must not roll back step 1.

---

## 19. AI Lab security boundary

AI Lab must be isolated from normal learner data.

### ai_lab_connections
Provider configuration and encrypted credentials.

### ai_lab_sessions
Request lifecycle and metadata.

### ai_lab_interactions
Detailed interaction records.

Provider credentials:
- never sent to browser
- never stored in GitHub
- never exposed through learner-readable RLS
- encryption/key strategy must be defined before data migration

AI training context is server-side aggregate/reference data only.

---

## 20. Payments and legal

Payments are immutable financial history.

Keep:
- provider
- external transaction ID
- amount/currency
- status
- product/plan
- timestamps
- user linkage
- webhook provenance

Legal acceptance must preserve:
- user
- document/version
- accepted_at
- acceptance metadata required for compliance

Do not rewrite legal history during migration.

---

## 21. Migration metadata

Add a dedicated migration-control domain rather than scattering temporary columns everywhere.

Recommended tables:

### migration_batches
Tracks each migration batch.

### migration_records
Maps:
- source system
- source table
- source ID
- V2 table
- V2 ID
- migration status
- error
- migrated_at

This makes migration resumable and auditable.

Do not delete source IDs after successful migration.

---

## 22. Data ownership map

| Domain | Owner |
|---|---|
| Identity | Core platform |
| Content | Learning platform |
| Attempts | Learning platform |
| Raw telemetry | Learning platform |
| Question DNA | Intelligence |
| Candidate DNA | Intelligence |
| Interventions | Intelligence |
| PIE | PIE |
| AMC rules | AMC adapter |
| AI Lab | AI Lab service |
| Payments | Platform/Payments |
| Legal | Compliance |
| RBAC | Command/Security |
| Audit | Command/Security |
| Notifications | Platform |
| Secrets | Server-side infrastructure |

No domain should silently write into another domain's canonical state.

---

## 23. Recommended V2 dependency graph

```
AUTH
  |
PROFILES
  |
TAXONOMY ---- CONTENT
  |              |
  +-------+------+
          |
     SESSIONS
          |
      ATTEMPTS
          |
    RAW TELEMETRY
          |
   +------+------+----------------+
   |             |                |
QUESTION DNA  CANDIDATE DNA   CONFIDENCE
   |             |                |
   +------+------+----------------+
          |
    INTERVENTIONS
          |
        PIE
          |
    AMC ADAPTER
          |
   DECISIONS / ACTIONS
```

Admin, audit and security surround the graph rather than becoming part of the learner transaction path.

---

## 24. Migration sequence

### M0 — empty V2 foundation
- Supabase project
- extensions
- schemas
- auth configuration
- migration control

### M1 — identity
- profiles
- admin roles
- legal

### M2 — content
- subjects
- subtopics
- questions
- stations
- flashcards/model content

### M3 — learning transactions
- sessions
- attempts
- progress
- notes
- bookmarks
- study plans

### M4 — raw telemetry
- behavior events
- confidence telemetry
- session events

### M5 — intelligence
- question DNA
- behavior DNA
- readiness DNA
- subject DNA
- confidence
- interventions

### M6 — PIE
- observations
- state
- uncertainty
- inference
- validation
- decisions
- provenance

### M7 — AMC adapter
- blueprint
- task taxonomy
- exam environment
- validation/certification

### M8 — platform/admin
- payments
- notifications
- security
- audit
- AI Lab

### M9 — feature verification
- social features
- chat
- referrals
- presence
- other VERIFY domains

### M10 — cutover
- final delta migration
- read-only freeze of old write path
- validation
- environment switch
- post-cutover monitoring

---

## 25. Cutover principle

The old Lovable/Supabase system remains the production source until V2 passes:

1. schema validation
2. row-count reconciliation
3. foreign-key validation
4. RLS tests
5. function tests
6. Edge Function tests
7. Practice answer-save test
8. confidence-save test
9. OSCE attempt-save test
10. intelligence failure isolation test
11. admin RBAC test
12. payment/webhook test
13. export/import test
14. backup/restore test

Only then should the application environment point to V2.

---

## 26. Phase 2 decisions

### Decision 1
Do not clone the historical Supabase schema.

### Decision 2
Preserve UUIDs wherever possible.

### Decision 3
Keep raw learning events separate from derived intelligence.

### Decision 4
Reduce database trigger chains.

### Decision 5
Make intelligence asynchronous/independent from answer persistence.

### Decision 6
PIE is exam-neutral.

### Decision 7
AMC is an adapter/plugin layer.

### Decision 8
Admin security is server-enforced, not merely UI-enforced.

### Decision 9
Benchmark/model/training data is private by default.

### Decision 10
Migration must be resumable and auditable.

---

## 27. Phase 2 gate

Architecture status:

- Domain architecture: PASS
- Core dependency direction: PASS
- Learning transaction boundary: PASS
- Intelligence boundary: PASS
- PIE boundary: PASS
- AMC adapter boundary: PASS
- Security/RLS strategy: PASS
- Trigger strategy: PASS
- Migration sequence: PASS
- Production migration: NOT STARTED
- Live schema reconciliation: BLOCKED until Supabase read access is available

### Next phase

**Phase 3 — V2 database specification**

Phase 3 should turn this architecture into exact executable definitions:
- table-by-table columns
- data types
- primary/foreign keys
- unique constraints
- check constraints
- indexes
- RLS policies
- RPC/function contracts
- trigger definitions
- enum strategy
- migration-control tables
- exact compatibility requirements for the existing frontend

No production data should be moved during Phase 3.
