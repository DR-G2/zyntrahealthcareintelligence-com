# Zyntra V2 Supabase Migration — Phase 3 Database Specification

Date: 2026-10-06
Repository: DR-G2/zyntrahealthcareintelligence-com
Architecture: `docs/migration/ZYNTRA_V2_PHASE2_ARCHITECTURE.md`

## 1. Purpose

Phase 3 converts the V2 architecture into an implementation-ready database contract.

This document defines:
- schemas
- tables
- primary/foreign keys
- core columns
- constraints
- indexes
- RLS ownership
- function/RPC boundaries
- trigger rules
- migration-control requirements
- frontend compatibility requirements

It is a specification, not an instruction to modify the existing production database.

---

# 2. PostgreSQL schema layout

Use explicit schemas to separate ownership.

## `public`
Application-facing canonical data:
- profiles
- taxonomy
- content
- sessions
- attempts
- learner-owned data
- safe intelligence summaries

## `intelligence`
Derived learning intelligence:
- question DNA
- behaviour DNA
- readiness
- subject DNA
- confidence
- interventions

## `pie`
Exam-neutral inference/decision system.

## `amc`
AMC-specific adapter.

## `command`
Admin, security and audit.

## `ai_lab`
AI provider/session data.

## `migration`
Migration-only control tables.

Principle: schema ownership is explicit. Do not mix PIE, AMC, admin and learner tables in one namespace.

---

# 3. ID and timestamp standards

### IDs
- UUID primary keys
- generated with `gen_random_uuid()`
- auth identity uses Supabase Auth UUID

### Timestamps
Use `timestamptz`.

Standard fields:
- created_at NOT NULL DEFAULT now()
- updated_at NOT NULL DEFAULT now() where mutable

### JSON
Use JSONB, not JSON, for new flexible structures.

### Soft deletion
Do not add `deleted_at` everywhere.

Use it only where the business requirement genuinely needs reversible deletion.

### Versioning
Content and intelligence definitions use explicit version fields.

---

# 4. Identity tables

## public.profiles

Primary:
`id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE`

Recommended columns:
- email text
- display_name text
- avatar_url text
- country text
- timezone text
- role text
- status text NOT NULL DEFAULT 'active'
- created_at timestamptz NOT NULL
- updated_at timestamptz NOT NULL

Constraints:
- status controlled by CHECK or enum
- email is not an authorization key

Indexes:
- email
- status

RLS:
- user can SELECT own row
- user can UPDATE own permitted profile fields
- INSERT performed by controlled signup path
- privileged fields are not user-writable

---

# 5. Taxonomy

## public.subjects

Columns:
- id uuid PK
- name text NOT NULL
- slug text NOT NULL UNIQUE
- description text
- sort_order integer NOT NULL DEFAULT 0
- is_active boolean NOT NULL DEFAULT true
- created_at
- updated_at

## public.subtopics

Columns:
- id uuid PK
- subject_id uuid NOT NULL FK subjects
- name text NOT NULL
- slug text NOT NULL
- description text
- sort_order integer DEFAULT 0
- is_active boolean DEFAULT true
- created_at
- updated_at

Unique:
`(subject_id, slug)`

Index:
`subject_id`

RLS:
- learner SELECT active taxonomy
- writes server/admin only

---

# 6. Questions

## public.questions

Canonical question content.

Columns:
- id uuid PK
- zyntra_id text UNIQUE
- subject_id uuid NOT NULL FK subjects
- subtopic_id uuid FK subtopics
- stem text NOT NULL
- options jsonb NOT NULL
- correct_answer text NOT NULL
- explanation text
- difficulty_tier text
- status text NOT NULL DEFAULT 'active'
- version integer NOT NULL DEFAULT 1
- provenance jsonb NOT NULL DEFAULT '{}'
- created_at
- updated_at

Constraints:
- options must be a JSON object/array matching application contract
- correct_answer must be non-empty
- status controlled
- version >= 1

Indexes:
- subject_id
- subtopic_id
- status
- difficulty_tier
- zyntra_id

RLS:
- learner SELECT only active/published content
- content mutation server/admin only

Important:
Question DNA does NOT live here.

---

# 7. OSCE stations

## public.clinical_stations

Columns:
- id uuid PK
- zyntra_id text UNIQUE
- subject text NOT NULL
- scenario_title text NOT NULL
- candidate_instructions text
- examiner_instructions text
- marking_checklist jsonb
- scenario_data jsonb NOT NULL DEFAULT '{}'
- reading_time_minutes integer
- station_time_minutes integer
- status text NOT NULL DEFAULT 'active'
- version integer NOT NULL DEFAULT 1
- provenance jsonb NOT NULL DEFAULT '{}'
- created_at
- updated_at

Checks:
- reading_time_minutes >= 0
- station_time_minutes > 0 when present
- version >= 1

RLS:
- learner SELECT published stations
- mutation server/admin only

---

# 8. Practice sessions

## public.practice_sessions

Purpose: one practice run.

Columns:
- id uuid PK
- user_id uuid NOT NULL FK profiles
- session_type text NOT NULL
- status text NOT NULL DEFAULT 'active'
- config jsonb NOT NULL DEFAULT '{}'
- started_at timestamptz
- completed_at timestamptz
- last_activity_at timestamptz
- created_at
- updated_at

Checks:
- completed_at required when status = completed
- completed_at >= started_at when both exist

Indexes:
- (user_id, status)
- (user_id, created_at DESC)

RLS:
- user owns SELECT/INSERT/UPDATE
- server/admin privileged access through controlled paths

## public.practice_session_questions

Columns:
- id uuid PK
- session_id uuid NOT NULL FK practice_sessions ON DELETE CASCADE
- question_id uuid NOT NULL FK questions
- position integer NOT NULL
- presented_at timestamptz
- answered_at timestamptz
- created_at

Unique:
`(session_id, position)`

Index:
`(session_id, question_id)`

RLS:
- owner through parent session

---

# 9. User attempts

## public.user_attempts

One row = one submitted MCQ answer.

Columns:
- id uuid PK
- user_id uuid NOT NULL FK profiles
- question_id uuid NOT NULL FK questions
- session_id uuid FK practice_sessions
- selected_answer text NOT NULL
- is_correct boolean NOT NULL
- time_taken_seconds integer
- confidence_level smallint
- answer_changes_count integer NOT NULL DEFAULT 0
- time_to_first_click integer
- change_sequence jsonb
- pause_events jsonb
- time_of_day text
- question_position integer
- previous_question_correct boolean
- question_version integer
- app_version text
- provenance jsonb NOT NULL DEFAULT '{}'
- created_at timestamptz NOT NULL

Checks:
- confidence_level BETWEEN 1 AND 5 when not null
- answer_changes_count >= 0
- time_taken_seconds >= 0 when not null
- time_to_first_click >= 0 when not null
- question_position >= 0 when not null
- question_version >= 1 when not null

Indexes:
- (user_id, created_at DESC)
- (user_id, question_id, created_at DESC)
- session_id
- question_id
- confidence_level

RLS:
- learner SELECT own
- learner INSERT own
- learner cannot UPDATE correctness or telemetry after submission
- learner cannot DELETE attempts
- server/admin controlled correction path only

### Critical rule

No trigger on this table may call PIE or any non-essential intelligence operation synchronously.

---

# 10. OSCE sessions and attempts

## public.station_sessions

Columns:
- id uuid PK
- user_id uuid FK profiles
- status
- config jsonb
- started_at
- completed_at
- created_at
- updated_at

## public.station_session_items

Columns:
- id uuid PK
- session_id uuid FK station_sessions
- station_id uuid FK clinical_stations
- position integer
- presented_at
- completed_at
- created_at

Unique:
`(session_id, position)`

## public.station_attempts

Columns:
- id uuid PK
- user_id uuid FK profiles
- station_id uuid FK clinical_stations
- session_id uuid FK station_sessions
- started_at
- completed_at
- duration_seconds
- checklist_result jsonb
- candidate_response jsonb
- evaluation jsonb
- score numeric
- evaluator_type text
- evaluator_version text
- provenance jsonb
- created_at

RLS:
- own records for learner
- privileged evaluation writes server-side

---

# 11. Progress and learner preferences

## public.user_progress

Keep the capability but make ownership explicit.

Core:
- id
- user_id
- subject_id nullable
- questions_attempted
- correct_count
- streak
- last_activity_at
- created_at
- updated_at

Unique:
`(user_id, subject_id)` where subject is nullable-safe according to application design.

## public.user_program_progress

Tracks program-level progress.

## public.study_plans

Owns candidate study plans.

## public.bookmarks
Unique:
`(user_id, question_id)`

## public.user_notes
Unique/lookup:
`(user_id, question_id)`

## public.station_bookmarks
Unique:
`(user_id, station_id)`

## public.station_notes
Unique/lookup:
`(user_id, station_id)`

All learner-owned tables use ownership-based RLS.

---

# 12. Raw telemetry

Create schema `intelligence`.

## intelligence.behavior_events

Columns:
- id uuid PK
- user_id uuid NOT NULL FK public.profiles
- session_id uuid FK public.practice_sessions
- question_id uuid FK public.questions
- event_type text NOT NULL
- event_version integer NOT NULL DEFAULT 1
- occurred_at timestamptz NOT NULL DEFAULT now()
- sequence_no integer
- question_position integer
- payload jsonb NOT NULL DEFAULT '{}'
- created_at timestamptz NOT NULL DEFAULT now()

Checks:
- event_version >= 1
- sequence_no >= 0 when present
- question_position >= 0 when present

Indexes:
- (user_id, occurred_at DESC)
- (session_id, sequence_no)
- (question_id, occurred_at DESC)
- event_type

RLS:
- learner INSERT own events
- learner SELECT own events only if product needs it
- intelligence/service role can read
- learner cannot update/delete

Raw events are append-only.

---

# 13. Intelligence tables

## intelligence.question_dna

One current state per question/version.

Core:
- id uuid PK
- question_id uuid NOT NULL FK public.questions
- question_version integer NOT NULL
- dna_version integer NOT NULL
- difficulty_score numeric
- discrimination_score numeric
- timing_profile jsonb
- confidence_profile jsonb
- stability_profile jsonb
- ambiguity_flags jsonb
- evidence_window jsonb
- model_version text
- calculated_at timestamptz
- updated_at timestamptz

Unique:
`(question_id, question_version)`

## intelligence.question_dna_history

Immutable historical snapshots.

## intelligence.behavior_dna

One current candidate state.

Key:
`user_id UNIQUE`

Store:
- archetype
- rush_index
- hesitation_index
- fatigue_index
- stability metrics
- evidence window
- model version
- calculated_at
- updated_at

## intelligence.readiness_dna

One current candidate readiness state.

Key:
`user_id UNIQUE`

Store readiness dimensions separately from raw attempts.

## intelligence.subject_dna

Unique:
`(user_id, subject_id)`

## intelligence.confidence_intelligence

Unique:
`(user_id, evidence_window/version)`

Store:
- calibration
- overconfidence
- underconfidence
- confidence stability
- model version
- evidence window
- calculated_at

Derived intelligence is server-managed.

Learner RLS exposes only approved summary views or safe columns.

---

# 14. Ideal candidate benchmark

## intelligence.ideal_candidate_profile

Columns:
- id uuid PK
- version integer UNIQUE
- name
- dimensions jsonb
- weights jsonb
- effective_from
- effective_to
- is_active
- created_at

RLS:
- NO learner direct access
- server/admin only

Do not expose benchmark internals merely because a learner can see their own readiness.

---

# 15. Intervention engine

## intelligence.intervention_catalog
Global intervention definitions.

## intelligence.candidate_interventions
Candidate-specific recommendation.

## intelligence.intervention_outcomes
Observed response/outcome.

## intelligence.intervention_effectiveness
Aggregated effectiveness.

## intelligence.next_best_actions
Current action queue/cache.

All writes are server-controlled.

Learners receive only their own actionable recommendations.

---

# 16. PIE schema

Create schema `pie`.

The following tables use UUID PKs and explicit version/provenance fields:

### Model/provenance
- pie_model_version
- pie_observation
- pie_inference_run

### Candidate
- pie_candidate_state
- pie_state_uncertainty
- pie_dynamic_state
- pie_dynamic_observation

### Question
- pie_question_state
- pie_question_uncertainty
- pie_identifiability
- pie_hypothesis
- pie_question_quarantine

### Validation
- pie_validation_run
- pie_validation_metric
- pie_validation_claim

### Exam
- pie_exam_environment
- pie_exam_adapter_snapshot
- pie_exam_readiness

### DWIG
- pie_dwig_candidate
- pie_dwig_selection
- pie_dwig_outcome
- pie_dwig_evaluation

### Decision
- pie_decision_candidate
- pie_decision
- pie_decision_outcome

### Intervention evidence
- pie_intervention_outcome
- pie_intervention_effect_estimate
- pie_intervention_causal_evidence

### Runtime
- pie_runtime_decision
- pie_runtime_gate
- pie_shadow_run
- pie_certification_gate

### Compatibility
- pie_legacy_compatibility

PIE tables must reference canonical public/intelligence IDs where appropriate.

No PIE table may become a foreign-key prerequisite for inserting `public.user_attempts`.

---

# 17. AMC schema

Create schema `amc`.

Tables:
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

All AMC tables are server/admin controlled unless a specific learner-safe read is explicitly required.

---

# 18. Command/security schema

Create schema `command`.

## command.admin_roles

Fields:
- id
- user_id
- role
- active
- created_at
- updated_at

Unique:
`(user_id, role)`

## command.admin_activity_logs

Fields:
- id
- actor_user_id
- actor_role
- action
- target_type
- target_id
- reason
- before_snapshot
- after_snapshot
- correlation_id
- created_at

Audit rows are append-only.

## command.manual_overrides
High-risk override records.

## command.system_health_logs
## command.system_error_logs
## command.piracy_strikes
## command.watermark_settings

RLS:
- no ordinary learner access
- role-based server/admin access

---

# 19. AI Lab schema

Create `ai_lab`.

## ai_lab.connections
Contains encrypted provider credentials.

## ai_lab.sessions
Request/session metadata.

## ai_lab.interactions
Detailed interaction history.

Credential policy:
- never learner-readable
- never browser-readable
- never returned by generic SELECT
- server-side encryption/key management required

AI training context should be isolated from candidate records.

---

# 20. Payments/legal/platform

These can remain in public or dedicated schemas depending on implementation.

Minimum domains:

### payments
Immutable provider transaction history.

### user_legal_acceptance
Versioned legal acceptance.

### push_subscriptions
User-owned notification endpoints.

### data_export_history
Export audit history.

### site_settings
Server-controlled platform configuration.

Payment webhook processing must be idempotent using provider transaction identifiers.

---

# 21. Migration-control schema

Create `migration`.

## migration.batches

Fields:
- id
- source_system
- started_at
- completed_at
- status
- source_snapshot
- notes

## migration.records

Fields:
- id
- batch_id
- source_table
- source_id
- target_schema
- target_table
- target_id
- status
- error_message
- migrated_at

Unique:
`(source_table, source_id, target_schema, target_table)`

This makes migration resumable.

---

# 22. RLS matrix

| Domain | Learner read | Learner insert | Learner update | Learner delete |
|---|---|---|---|---|
| profiles | own | controlled | limited own | no |
| taxonomy | published | no | no | no |
| questions | published | no | no | no |
| stations | published | no | no | no |
| sessions | own | own | own | controlled |
| attempts | own | own | no | no |
| raw events | own if needed | own | no | no |
| question DNA | safe summary only | no | no | no |
| candidate DNA | own safe summary | no | no | no |
| PIE | no direct by default | no | no | no |
| AMC config | no direct | no | no | no |
| admin/audit | no | no | no | no |
| AI credentials | no | no | no | no |
| payments | own safe history | controlled | no | no |
| legal | own | controlled | no | no |

---

# 23. RPC/function contract strategy

Do not expose broad generic database functions.

Prefer narrowly named operations.

Required initial contracts:

### Learning
- `create_practice_session()`
- `save_attempt()`
- `resume_practice_session()`
- `complete_practice_session()`

### Intelligence
- `rebuild_question_dna()`
- `rebuild_candidate_intelligence()`
- `rebuild_readiness()`
- `get_confidence_intelligence()`
- `get_next_best_action()`

### PIE
- `pie_record_observation()`
- `pie_infer_candidate_state()`
- `pie_create_decision()`
- `pie_validate_run()`

### Admin
- `admin_inspect_candidate()`
- `admin_apply_override()`
- `admin_write_audit()`

The frontend should not need service-role credentials.

---

# 24. Trigger contract

Allowed triggers:

1. updated_at maintenance
2. tightly scoped referential/integrity enforcement
3. audit capture where legally/security required

Forbidden as synchronous attempt dependencies:

- PIE inference
- readiness rebuild
- behaviour rebuild
- question DNA calculation
- intervention selection
- AI generation
- network calls

---

# 25. Index strategy

Prioritize indexes on:
- user_id + created_at
- session_id
- question_id
- subject_id
- subtopic_id
- status
- event timestamp
- foreign-key columns
- unique business keys

Do not create indexes simply because a column exists.

Every additional index increases write cost.

---

# 26. Constraint strategy

Use database constraints for facts that must always be true:

Examples:
- confidence 1–5
- non-negative durations
- unique session positions
- unique bookmarks
- valid foreign keys
- valid status values
- version >= 1

Use application/service logic for rules that evolve frequently.

---

# 27. Frontend compatibility contract

The current frontend expects Supabase environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

V2 should preserve these names.

This allows the final cutover to be primarily an environment switch rather than a rewrite of every component.

Where the frontend currently calls historical RPC names, create temporary V2 compatibility functions.

Compatibility functions must:
- be documented
- have an owner
- have a removal target
- not recreate legacy architecture internally

---

# 28. Edge Function compatibility

The new project should initially preserve stable function names where the frontend depends on them.

Functions should then be migrated from legacy implementation to V2 contracts.

Priority:
1. authentication
2. answer/attempt operations
3. Practice
4. OSCE
5. intelligence
6. PIE
7. admin
8. AI Lab
9. payments
10. notifications

---

# 29. Security rules

Never migrate:
- service-role keys
- provider API secrets
- browser-injected admin secrets
- encryption master keys
- private signing keys

Secrets must be recreated in the V2 project's secret store.

Existing encrypted provider credentials require a deliberate decryption/re-encryption strategy before migration.

---

# 30. Phase 3 implementation gates

Before Phase 4:

### Schema
- all core tables defined
- all FKs defined
- constraints defined
- indexes defined

### Security
- RLS policies defined
- privileged schemas protected
- learner/admin separation tested

### Intelligence
- derived/source separation confirmed
- no synchronous intelligence dependency on attempts

### PIE
- no attempt FK dependency
- provenance/version fields defined
- AMC adapter boundary confirmed

### Migration
- migration batches defined
- source-to-target mapping possible
- resumability defined

### Frontend
- environment switch preserved
- compatibility RPC strategy defined
- Edge Function naming strategy defined

---

# 31. Phase 3 status

Architecture: PASS

Database specification: PASS

Production schema creation: NOT STARTED

Production data migration: NOT STARTED

Live schema reconciliation: STILL BLOCKED by Supabase MCP permissions.

## Next phase

**Phase 4 — executable migration package**

Phase 4 will turn this specification into:
- ordered SQL migration files
- schemas
- tables
- indexes
- constraints
- RLS
- functions
- audit framework
- migration-control framework
- seed/reference data strategy

It will still NOT touch the current production database.
