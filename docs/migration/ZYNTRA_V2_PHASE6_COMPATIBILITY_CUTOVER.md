# Zyntra V2 Phase 6 — Static Validation, Compatibility Map and Cutover Plan

Date: 2026-10-06
Repository: DR-G2/zyntrahealthcareintelligence-com

## 1. Purpose

Phase 6 is the final design gate before creating the new Supabase project.

The repository was searched for:
- direct Supabase table access
- RPC calls
- Edge Function calls
- Supabase environment variables
- legacy intelligence contracts
- PIE contracts

No live Supabase changes were made.

---

# 2. Important finding: V2 is NOT yet a drop-in replacement

The current frontend still references several legacy table names and fields that do not exist in the clean V2 schema.

Examples found in the current repository include:

- `behavior_events`
- `readiness_dna`
- `behavior_profiles`
- `performance_profiles`
- `subject_dna`
- `admin_roles`
- `manual_overrides`
- `admin_activity_logs`
- `watermark_settings`
- `piracy_strikes`
- `contact_submissions`
- `page_views`
- `intent_signals`
- `visitor_sessions`
- flashcard tables
- social/collaboration tables

This is expected.

It means the final cutover cannot be just "change the Supabase URL".

The compatibility layer must be planned before switching the frontend.

---

# 3. Environment compatibility

Current frontend contract:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

V2 will preserve these names.

At cutover, changing these values should redirect the frontend to V2 without requiring a global environment-variable rewrite.

### Security observation

The repository's current `.env` contains the Supabase publishable/anon key.

That key is designed to be browser-visible, so it is not equivalent to a service-role secret.

However:
- service-role keys must never enter Git
- provider API keys must never enter Git
- V2 secret values must be configured in Supabase/project secret storage

---

# 4. Core compatibility map

| Current frontend contract | V2 contract | Strategy |
|---|---|---|
| profiles | public.profiles | preserve |
| subjects | public.subjects | preserve |
| subtopics | public.subtopics | preserve |
| questions | public.questions | preserve |
| clinical_stations | public.clinical_stations | preserve |
| user_attempts | public.user_attempts | preserve |
| active_sessions | public.practice_sessions | compatibility adapter |
| station_attempts | public.station_attempts | preserve/clean fields |
| bookmarks | public.bookmarks | preserve |
| user_notes | public.user_notes | preserve |
| station_bookmarks | public.station_bookmarks | preserve |
| station_notes | public.station_notes | preserve/compatibility |
| user_progress | public.user_progress | preserve |
| study_plans | public.study_plans | preserve/compatibility |
| behavior_events | intelligence.behavior_events | adapter or frontend update |
| readiness_dna | intelligence.readiness_dna | safe view/RPC |
| subject_dna | intelligence.subject_dna | safe view/RPC |
| behavior_profiles | intelligence.behavior_dna | compatibility RPC/view |
| performance_profiles | retire/compatibility | do not recreate as canonical |
| question_dna | intelligence.question_dna | server-managed |
| ideal_candidate_profile | intelligence.ideal_candidate_profile | server-only |
| admin_roles | command.admin_roles | server/admin boundary |
| admin_activity_logs | command.admin_activity_logs | server/admin boundary |
| manual_overrides | command.manual_overrides | server/admin boundary |
| AI training context | AI Lab/server domain | server-only |
| PIE tables | pie.* | Edge Function/RPC boundary |
| AMC tables | amc.* | adapter boundary |

---

# 5. Current RPC compatibility

## Existing diagnostic RPCs

Current Landing flow uses:

- `get_diagnostic_question`
- `submit_diagnostic_answer`

These must exist in V2 before the landing page is switched.

They should be reimplemented against V2 content/diagnostic state rather than copying historical implementation.

## Existing confidence RPC

Current Performance Intelligence uses:

- `get_confidence_intelligence()`

V2 should preserve this function name as a compatibility contract.

Implementation should read V2 intelligence tables.

## PIE compatibility

Current repository contains:

- `get_performance_intelligence_compat(...)`
- `pie_persist_state_snapshot(...)`

These are legacy compatibility contracts.

V2 should retain compatibility only where an active frontend/Edge Function still requires them.

They must not become the permanent architecture.

---

# 6. Current Edge Function compatibility

The repository contains many Edge Functions.

Priority migration groups:

## Group A — cutover critical

- pie-shadow-sync
- pie-infer-state
- pie-shadow-run
- amc-intelligence
- admin-inspect-user
- export-learning-data
- import-learning-data
- generate-study-plan
- generate-station
- evaluate-station
- generate-model-answer

## Group B — core learning

- generate-questions
- import-questions
- compute-question-tiers
- generate-flashcards
- generate-training-notifications
- track-presence
- send-push-notification

## Group C — admin/security

- admin-user-actions
- admin-list-users
- admin-bulk-users
- admin-manage-questions
- admin-manage-stations
- admin-manage-strikes
- admin-grant-access
- admin-audit-quality
- admin-screenshot-logs
- system-health-check

## Group D — payments

- create-razorpay-order
- verify-razorpay-payment
- razorpay-webhook
- create-paypal-order
- verify-paypal-payment
- customer-portal
- check-subscription

## Group E — optional/feature-specific

Social, chat, referrals, presence and other VERIFY domains.

---

# 7. Practice compatibility

The current Practice page directly writes `user_attempts`.

V2 should eventually switch this to:

`public.save_attempt(...)`

This is preferred over allowing the frontend to know every database detail.

The migration target is:

Frontend
→ save_attempt()
→ user_attempts

Then independently:

user_attempts
→ behaviour event
→ intelligence
→ PIE

No intelligence operation may be part of `save_attempt()`.

---

# 8. Confidence compatibility

Current UI already expects confidence intelligence.

V2 therefore keeps:

`get_confidence_intelligence()`

But the underlying source becomes:

`user_attempts.confidence_level`

plus raw behaviour events.

Missing confidence must remain missing.

It must NOT be converted to zero.

---

# 9. Performance Intelligence compatibility

Current Performance Intelligence reads:
- readiness_dna
- user_attempts
- confidence RPC
- PIE shadow sync

V2 should change the read path to:

- public.my_readiness
- public.my_behavior_dna
- public.my_subject_dna
- public.my_confidence_intelligence
- a candidate-safe PIE endpoint

The browser should not query raw PIE tables.

---

# 10. Legacy intelligence retirement

Do NOT recreate these as canonical V2 tables:

- performance_profiles
- behavior_profiles
- old trigger-driven readiness calculations
- duplicate legacy intelligence compatibility tables

They may temporarily exist as compatibility views/functions if the frontend requires them.

They are not sources of truth.

---

# 11. Data migration mapping

## Identity

Old:
`profiles.id`

→ V2:
`profiles.id`

Keep UUID.

## Content

Old:
`subjects.id`
`subtopics.id`
`questions.id`
`clinical_stations.id`

→ V2 same UUID.

## Attempts

Old:
`user_attempts.id`

→ V2:
`user_attempts.id`

Preserve:
- question
- selected answer
- correctness
- timing
- confidence
- answer changes
- pauses
- question position
- session relationship
- timestamps

## Sessions

Old:
`active_sessions`

→ V2:
`practice_sessions`

Map the stable session identity and configuration.

If the old table stores multiple concepts in one JSON field, split them into:
- practice_sessions
- practice_session_questions

## Raw behaviour

Old:
`behavior_events`

→ V2:
`intelligence.behavior_events`

Preserve original timestamp and event version.

## Intelligence

Old derived intelligence:

→ V2 recomputation preferred.

Where recomputation is not possible, migrate a snapshot into the V2 derived table with provenance identifying:
- legacy model
- legacy calculation date
- source system
- migration batch

## PIE

Migrate only useful historical provenance/state.

Do not blindly copy every legacy PIE row.

PIE state should be reconstructed from canonical observations wherever possible.

---

# 12. Migration classification after Phase 6

## KEEP / direct migration

- profiles
- subjects
- subtopics
- questions
- clinical_stations
- user_attempts
- sessions/progress
- bookmarks
- notes
- flashcards
- payments
- legal records

## REBUILD / recompute

- question DNA
- behavior DNA
- readiness DNA
- subject DNA
- confidence intelligence
- interventions
- next-best actions
- PIE candidate state
- PIE runtime state

## SNAPSHOT / provenance migration

- useful historical intelligence
- useful PIE validation evidence
- useful admin audit history

## COMPATIBILITY ONLY

- performance_profiles
- behavior_profiles
- legacy PIE compatibility
- historical RPC contracts

## VERIFY BEFORE MIGRATION

- social/collaboration
- chat
- referrals
- visitor analytics
- presence
- contact submissions
- optional AI logs

---

# 13. Static validation results

### PASS

- V2 migration files are ordered numerically.
- Core foreign-key direction is coherent.
- Attempt table has no PIE/intelligence trigger.
- Sensitive intelligence tables have no learner direct policy.
- Admin authorization is separated from learner authorization.
- AI credential table is not learner-readable.
- Migration tracking is resumable.
- Environment variable names remain compatible.
- UUID identity strategy remains compatible.
- PIE and AMC are separated from core learning transactions.

### REQUIRES LIVE VALIDATION

These cannot be truthfully marked PASS without a real Supabase project:

- SQL execution
- schema grants
- Postgres function compilation
- RLS behaviour
- Auth role behaviour
- view security
- Edge Function deployment
- RPC invocation
- foreign-key runtime behaviour
- query performance
- backup/restore

The current Supabase MCP connection has previously returned permission errors for live inspection.

---

# 14. Phase 6 cutover gates

Before production cutover, V2 must demonstrate:

### Gate A — database

- all migrations execute cleanly
- no missing dependencies
- no broken foreign keys
- no unintended public grants

### Gate B — authentication

- signup
- login
- logout
- session refresh
- password recovery

### Gate C — Practice

- question loads
- answer selection
- confidence selection
- answer saves
- duplicate submission protection
- session resumes
- completion works

### Gate D — intelligence

- behaviour event recorded
- readiness calculated
- confidence intelligence calculated
- Question DNA calculation works
- failures do not block answer saving

### Gate E — PIE

- shadow inference works
- candidate state persists
- uncertainty persists
- runtime gate works
- certification gate blocks unapproved runtime decisions

### Gate F — AMC

- blueprint loads
- task taxonomy loads
- question context resolves
- exam environment resolves

### Gate G — security

- learner cannot read another learner
- learner cannot read benchmark internals
- learner cannot read PIE internals
- learner cannot read AI credentials
- admin role boundaries work
- audit is immutable

### Gate H — migration

- row counts reconcile
- foreign keys reconcile
- sampled records match
- historical attempts preserve timestamps/results
- intelligence can be recomputed

---

# 15. Cutover sequence

1. Create V2 Supabase.
2. Execute V2 migrations.
3. Run static SQL validation.
4. Configure Auth.
5. Configure secrets.
6. Deploy Edge Functions.
7. Seed taxonomy/content.
8. Seed AMC configuration.
9. Create admin roles.
10. Migrate a small test cohort.
11. Run complete Practice/OSCE tests.
12. Run security tests.
13. Migrate remaining historical data.
14. Reconcile counts.
15. Run intelligence rebuild.
16. Run PIE in shadow mode.
17. Compare V2 outputs with legacy outputs.
18. Fix compatibility gaps.
19. Freeze legacy writes.
20. Perform final delta migration.
21. Switch environment variables.
22. Monitor.
23. Keep legacy system read-only for rollback.
24. Retire legacy only after stability period.

---

# 16. Rollback plan

If V2 fails after cutover:

1. switch frontend environment back to legacy Supabase
2. stop V2 writes
3. preserve V2 logs
4. identify failed gate
5. repair V2
6. repeat delta migration
7. retry cutover

Never destroy the old database immediately after switching.

---

# 17. Phase 6 decision

The V2 database is now sufficiently specified to justify creating a real new Supabase project.

However, **do not create it automatically**.

Project creation is the next operational step and requires the Supabase cost-confirmation flow.

Recommended project:
- name: `zyntra-production`
- region: `ap-south-1` (Mumbai)

Before creation:
1. request project cost
2. show exact cost to user
3. obtain explicit confirmation
4. create project
5. apply Phase 4 + Phase 5 migrations
6. run live validation

---

# 18. Phase 6 gate

Architecture: PASS

Database specification: PASS

Executable foundation: PASS

PIE/AMC schema: PASS

Frontend compatibility mapping: PASS

Migration mapping: PASS

Cutover/rollback plan: PASS

Live SQL execution: PENDING

Live RLS validation: PENDING

New Supabase project: NOT CREATED

Production database: UNCHANGED

## Phase 7

**Create and validate the new Supabase project.**

This is the first phase that will require a real Supabase project.

No production cutover occurs in Phase 7.
