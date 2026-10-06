# Zyntra V2 Phase 5 — PIE/AMC + Security Validation

Date: 2026-10-06

## Completed

Phase 5 adds the executable PIE and AMC schema and the first privileged security contracts.

### PIE
- model/version provenance
- observations
- inference runs
- candidate state
- state uncertainty
- dynamic state/observations
- question state/uncertainty
- identifiability
- hypotheses
- quarantine
- validation
- exam environment
- DWIG
- decisions
- intervention evidence
- runtime decisions/gates
- shadow runs
- certification gates
- temporary legacy compatibility mapping

### AMC
- plugin versions
- blueprint
- task taxonomy
- question context
- exam environment
- adapter evaluation
- DWIG context
- intervention catalog
- validation
- certification

### Security
- admin authorization function
- audited admin write function
- learner-safe intelligence views
- PIE/AMC RLS
- sensitive tables remain server-side

## Validation principles

1. Attempt saving remains independent of PIE.
2. PIE is exam-neutral.
3. AMC is adapter-owned.
4. Benchmark/model controls are not learner-readable.
5. AI credentials remain server-only.
6. Audit writes require admin authorization.
7. Derived intelligence remains recomputable.

## Static validation checklist

Before applying to a real V2 project:

- [ ] Run all files in numeric order.
- [ ] Confirm Supabase role/schema grants.
- [ ] Confirm all referenced tables exist.
- [ ] Confirm RLS policies compile.
- [ ] Confirm `auth.uid()` behavior through authenticated requests.
- [ ] Confirm views do not expose other candidates.
- [ ] Confirm `command.is_admin()` cannot be spoofed by a client.
- [ ] Confirm service-role/server functions are the only PIE/AMC writers.
- [ ] Confirm no attempt trigger calls PIE.
- [ ] Confirm payment provider IDs are unique.
- [ ] Confirm migration records are resumable.
- [ ] Confirm frontend RPC names are mapped before cutover.

## Important limitation

No live Supabase project has been created or changed.

The repository currently contains the V2 package only.

Live SQL execution/verification must occur against the new project after it is created and the cost-confirmation step is completed.

## Phase 5 gate

PIE executable schema: PASS
AMC executable schema: PASS
Privileged security foundation: PASS
Learner-safe views: PASS
Production application: UNCHANGED
Live SQL validation: PENDING
