# Zyntra V2 Migration Package — Phase 4

Date: 2026-10-06

## Status

Phase 4 executable foundation created in:
`supabase/migrations_v2/`

Files:
- 0001_extensions_and_schemas.sql
- 0002_migration_control.sql
- 0003_core_identity_taxonomy.sql
- 0004_content.sql
- 0005_learning_transactions.sql
- 0006_learner_features.sql
- 0007_intelligence_core.sql
- 0008_command_ai_platform.sql
- 0009_rls.sql
- 0010_integrity_and_updated_at.sql
- 0011_core_functions.sql
- 0012_schema_permissions.sql

## Safety

These files are a V2 package only.

They have NOT been applied to the current production/Lovable Supabase project.

They create the foundation for a future clean Supabase project.

## Execution order

Run files strictly in numeric order.

Do not skip 0001 or 0003.

The package assumes a Supabase project where `auth.users` exists.

## What is included

### Foundation
- pgcrypto
- intelligence schema
- PIE schema
- AMC schema
- Command schema
- AI Lab schema
- migration schema

### Core learning
- profiles
- subjects
- subtopics
- questions
- clinical stations
- practice sessions
- session questions
- user attempts
- station sessions
- station attempts
- progress
- study plans
- notes
- bookmarks

### Intelligence
- raw behaviour events
- Question DNA
- Question DNA history
- Behaviour DNA
- Readiness DNA
- Subject DNA
- Confidence intelligence
- ideal candidate benchmark
- interventions
- next-best actions

### Security/operations
- Command roles
- audit logs
- manual overrides
- system health/error logs

### AI Lab
- provider connections
- sessions
- interactions

### Platform
- payments
- legal acceptance
- push subscriptions
- export history
- site settings

### Migration
- batches
- source-to-target migration records

## Important deliberate omission

The package does NOT yet implement the full PIE table graph or AMC adapter tables.

That is intentional.

Phase 4 establishes the foundation first. The full PIE/AMC executable schema should be generated only after their exact contracts are frozen and reviewed against the current repository functions.

This prevents another large block of speculative tables from becoming permanent architecture.

## Critical safety property

`public.user_attempts` has no intelligence trigger.

Saving an answer does not synchronously call:
- PIE
- Question DNA
- Behaviour DNA
- Readiness
- intervention logic
- AI

The `save_attempt()` RPC is intentionally narrow.

## RLS model

RLS is enabled on learner and sensitive tables.

Learners can access only their own:
- profiles
- sessions
- attempts
- progress
- notes
- bookmarks
- raw events
- safe candidate intelligence
- interventions
- payments/legal records where appropriate

There are deliberately no learner policies for:
- Question DNA
- Question DNA history
- ideal candidate benchmark
- Command
- AI Lab credentials
- migration control

## Important implementation note

Before applying this package to a new project, Phase 4 should be followed by a static SQL validation pass.

That pass should check:
- function signatures
- schema/table grants
- RLS policy dependencies
- Supabase role behavior
- nullable unique constraints
- frontend compatibility
- missing PIE/AMC dependencies

## Phase 4 gate

Executable foundation: PASS

Production database changed: NO

Production data moved: NO

New Supabase project created: NO

Full PIE executable schema: PENDING

Full AMC executable schema: PENDING

Live validation: PENDING until the new Supabase project exists.

## Next

Phase 5 should complete:
1. PIE executable schema
2. AMC executable schema
3. full RPC/function contracts
4. admin/RBAC security functions
5. safe learner intelligence views
6. migration seed/reference data
7. static SQL validation
8. frontend compatibility map

Only after that should the new Supabase project be created and the package tested there.
