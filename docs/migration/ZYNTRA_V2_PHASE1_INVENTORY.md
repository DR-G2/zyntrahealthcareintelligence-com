# Zyntra V2 Supabase Migration — Phase 1 Inventory

Date: 2026-10-06
Repository: DR-G2/zyntrahealthcareintelligence-com
Source inspected: GitHub default branch
Live Supabase comparison: BLOCKED by current MCP permission error (-32600)

## 1. Objective

Create a clean inventory before building the replacement Supabase project. The existing Lovable/Supabase backend remains untouched.

Rule: do not replay the entire historical migration chain blindly. Build a clean V2 schema from the final intended architecture, then migrate data separately.

## 2. Classification

- KEEP = preserve as a first-class V2 domain.
- REBUILD-CLEAN = preserve the capability/data meaning, but redesign the schema or triggers rather than copying historical patches.
- VERIFY = keep only after confirming current UI/function usage and live data.
- RETIRE-CANDIDATE = legacy/duplicate functionality that should not enter V2 unless evidence shows it is still required.

Because live row counts and deployed schema are not currently readable, no data is being marked for deletion.

## 3. Core application tables

| Table | Classification | Reason |
|---|---|---|
| profiles | KEEP | User profile foundation |
| questions | KEEP | Core question bank |
| subjects | KEEP | Question taxonomy |
| subtopics | KEEP | Question taxonomy |
| user_attempts | KEEP / REBUILD-CLEAN | Critical historical learning data; current schema has accumulated telemetry/trigger patches |
| active_sessions | KEEP | Practice session continuity |
| clinical_stations | KEEP | OSCE/station bank |
| station_attempts | KEEP / REBUILD-CLEAN | OSCE learning history |
| user_progress | KEEP | Learner progress |
| user_program_progress | KEEP | Program-level progress |
| study_plans | KEEP | Study planning |
| bookmarks | KEEP | Learner preference |
| user_notes | KEEP | Learner notes |
| station_bookmarks | KEEP | OSCE learner preference |
| station_notes | KEEP | OSCE notes |
| question_difficulty_tiers | REBUILD-CLEAN | Derived question intelligence |
| behavior_profiles | RETIRE-CANDIDATE | Legacy behavioural profile; superseded by canonical behavior_dna |
| performance_profiles | RETIRE-CANDIDATE | Legacy/aggregated intelligence layer; superseded by canonical intelligence |
| psychograph_history | VERIFY / RETIRE-CANDIDATE | Historical/legacy behaviour representation |
| chat_conversations | VERIFY | Preserve only if current chat feature uses it |

## 4. Social / collaboration

| Table | Classification | Reason |
|---|---|---|
| study_groups | VERIFY | Feature-specific |
| study_group_members | VERIFY | Feature-specific |
| shared_tests | VERIFY | Feature-specific |
| shared_test_participants | VERIFY | Feature-specific |
| referrals | VERIFY | Growth feature |
| feed_submissions | VERIFY | Social/content feature |

## 5. Payments, legal and platform

| Table | Classification | Reason |
|---|---|---|
| payments | KEEP / REBUILD-CLEAN | Financial history; must be preserved and isolated |
| user_legal_acceptance | KEEP | Compliance evidence |
| site_settings | KEEP | Platform configuration |
| push_subscriptions | KEEP | Notifications |
| user_usage_logs | KEEP / REBUILD-CLEAN | Usage/audit data |
| data_export_history | KEEP | Data portability audit |
| contact_submissions | VERIFY | Public contact workflow |

## 6. Security/admin

| Table | Classification | Reason |
|---|---|---|
| admin_roles | KEEP / REBUILD-CLEAN | Foundation for Zyntra Command RBAC |
| admin_activity_logs | KEEP | Immutable admin audit trail |
| system_health_logs | KEEP | Operational monitoring |
| system_error_logs | KEEP | Error/audit evidence |
| ai_feature_requests | VERIFY | Internal product workflow |
| ai_patch_logs | VERIFY | Internal engineering workflow |
| admin_message_threads | VERIFY | Admin communication |
| admin_messages | VERIFY | Admin communication |
| manual_overrides | KEEP / REBUILD-CLEAN | High-risk administrative actions require strict audit |
| piracy_strikes | KEEP | Security/content protection |
| watermark_settings | KEEP | Content protection |
| user_presence | VERIFY | Presence feature |
| user_legal_acceptance | KEEP | Compliance |

## 7. Learning/content extensions

| Table | Classification | Reason |
|---|---|---|
| flashcard_decks | KEEP | Learning content |
| flashcards | KEEP | Learning content |
| flashcard_reviews | KEEP | Learning history |
| model_answers | KEEP / REBUILD-CLEAN | Protected training/reference content |
| ai_training_context | REBUILD-CLEAN | Sensitive model context; strict server-only access |

## 8. Canonical intelligence

These are V2 intelligence domains and should not be copied as a random collection of historical patches.

| Table | Classification |
|---|---|
| ideal_candidate_profile | REBUILD-CLEAN |
| question_dna | REBUILD-CLEAN |
| behavior_dna | REBUILD-CLEAN |
| readiness_dna | REBUILD-CLEAN |
| subject_dna | REBUILD-CLEAN |
| behavior_events | KEEP / REBUILD-CLEAN |
| intervention_catalog | REBUILD-CLEAN |
| candidate_interventions | REBUILD-CLEAN |
| intervention_outcomes | REBUILD-CLEAN |
| intervention_effectiveness | REBUILD-CLEAN |
| next_best_actions | REBUILD-CLEAN |

Principle: raw candidate behaviour/events are retained; derived intelligence can be recomputed. Do not treat derived scores as irreplaceable source data.

## 9. Confidence intelligence

Confidence telemetry is part of the canonical attempt/intelligence pipeline.

Important fields found in the repository include confidence level, time-to-first-click, answer-change sequence, pause events, time-of-day, question position and previous-question correctness.

Classification:

- attempt telemetry: KEEP
- confidence telemetry: KEEP
- confidence-derived intelligence: REBUILD-CLEAN
- historical confidence repair migrations: DO NOT replay individually

## 10. PIE architecture

The repository contains a full PIE stack.

### Model/provenance
- pie_model_version
- pie_observation
- pie_inference_run

### Candidate state
- pie_candidate_state
- pie_state_uncertainty
- pie_dynamic_state
- pie_dynamic_observation

### Question state
- pie_question_state
- pie_question_uncertainty
- pie_identifiability
- pie_hypothesis
- pie_question_quarantine

### Validation
- pie_validation_run
- pie_validation_metric
- pie_validation_claim

### Exam adapter/readiness
- pie_exam_environment
- pie_exam_adapter_snapshot
- pie_exam_readiness

### DWIG / decision
- pie_dwig_candidate
- pie_dwig_selection
- pie_dwig_outcome
- pie_dwig_evaluation
- pie_decision_candidate
- pie_decision
- pie_decision_outcome

### Intervention/provenance
- pie_intervention_outcome
- pie_intervention_effect_estimate
- pie_intervention_causal_evidence

### Runtime/certification
- pie_runtime_decision
- pie_runtime_gate
- pie_shadow_run
- pie_certification_gate

### Compatibility
- pie_legacy_compatibility

### PIE classification
All PIE tables: **REBUILD-CLEAN**.

Reason: PIE is strategically important, but the new database should establish one canonical dependency graph, explicit service ownership, strict RLS and clean versioning rather than inherit historical P1-P17 patch order.

## 11. AMC Plugin

Found:

- amc_plugin_version
- amc_blueprint
- amc_task_taxonomy
- amc_question_context
- amc_exam_environment_v1
- amc_adapter_evaluation
- amc_dwig_context
- amc_intervention_catalog_v1
- amc_validation_run
- amc_validation_metric
- amc_validation_claim
- amc_certification_gate

Classification: **REBUILD-CLEAN**.

The AMC adapter should sit above the exam-neutral PIE core. It must not contaminate the core candidate state with fixed AMC assumptions.

## 12. AI Lab

Found:

- ai_lab_connections
- ai_lab_sessions
- ai_lab_interactions

Classification: **REBUILD-CLEAN**.

Important: encrypted provider credentials and AI interaction history must remain isolated from normal learner-readable data.

## 13. Edge Function inventory

Server functions identified include:

- pie-infer-state
- pie-shadow-run
- pie-shadow-sync
- admin-pie-inspect-user
- admin-pie-certification
- amc-intelligence
- ai-lab
- admin-inspect-user
- admin-audit-quality
- admin-send-notification
- admin-bulk-delete-users
- admin-screenshot-logs
- system-health-check
- check-subscription
- generate-questions
- generate-study-plan
- generate-station
- compute-question-tiers
- import-questions
- export-learning-data
- import-learning-data
- generate-training-notifications
- track-presence
- send-push-notification
- auth-email-hook

These will be migrated only after their database dependencies are mapped.

## 14. Dependency order for V2

The clean dependency direction should be:

1. Supabase Auth
2. Core identity/profile
3. Taxonomy and content
4. Attempts and sessions
5. Raw telemetry
6. Question DNA
7. Behaviour DNA
8. Readiness/Subject DNA
9. Confidence intelligence
10. Intervention engine
11. PIE observation/state
12. PIE validation and decision layers
13. AMC adapter
14. AI Lab
15. Admin/security services
16. Edge Functions
17. Frontend cutover

PIE should consume canonical observations and candidate state. It should not become a hidden dependency of basic answer saving.

## 15. Critical design rule from current production failures

Answer persistence must be independent from optional intelligence.

A learner answering a question must still be able to save the attempt even if:

- PIE is unavailable
- Question DNA is unavailable
- an intelligence calculation fails
- a shadow function fails
- a downstream analytics trigger fails

Intelligence is downstream of learning data, not the gatekeeper for saving it.

## 16. Data migration order

When live access is available:

1. users/auth identities
2. profiles
3. subjects/subtopics
4. questions
5. clinical stations
6. attempts
7. sessions/progress
8. raw behaviour events
9. learner notes/bookmarks
10. flashcards
11. payments/legal records
12. admin/security records
13. raw intelligence observations
14. derived intelligence snapshots where useful
15. PIE provenance/state
16. AI Lab data
17. remaining feature-specific tables

Derived intelligence should be recomputable from preserved source events wherever possible.

## 17. What must NOT be copied blindly

Do not blindly copy:

- historical migration order
- duplicate intelligence triggers
- legacy performance profile calculations
- legacy behaviour profile calculations
- old confidence repair migrations
- old PIE compatibility shims
- obsolete security policies
- old trigger chains
- secrets/API keys
- service-role credentials
- encrypted AI credentials without a deliberate key strategy

## 18. Phase 1B conclusion

The current backend is not one simple database. It is several generations of Zyntra architecture layered together.

The V2 migration should therefore be a **controlled reconstruction**, not a database clone.

## 19. Phase 1C gate

Before creating production V2, we need:

- live schema inventory
- live row counts
- live deployed Edge Function inventory
- current migration history
- extensions
- current RLS/policies
- current database functions/triggers
- environment/secret inventory
- frontend environment references

Current blocker: Supabase MCP permission prevents live inspection.

Until that is available, no destructive migration decision should be made.

## 20. Safety status

No production database was changed.
No user data was changed.
No migration was applied.
No new Supabase project was created.
