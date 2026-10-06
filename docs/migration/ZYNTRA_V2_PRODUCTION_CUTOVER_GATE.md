# Zyntra V2 Production Cutover Gate

## Current state

Target Supabase project: `hkowvjazuwebmibssdut`

Validated target:
- 225 active questions
- 9 subjects
- 45 subtopics
- V2 practice RPCs deployed
- learner-safe views present
- correct-answer column not granted to anon/authenticated
- intelligence policies restricted to authenticated users
- PIE runtime present
- AMC V8 development configuration present
- V2 AI Lab Edge Function ACTIVE
- V2 auth bridge ACTIVE

## Mandatory gates before production switch

1. Legacy source snapshot and row-count reconciliation
2. User/profile reconciliation
3. Question/content reconciliation
4. Practice/session/attempt reconciliation
5. Intelligence/PIE reconciliation
6. Security smoke tests with two separate learner identities
7. Production frontend environment verification
8. V2 Practice end-to-end acceptance test
9. Rollback rehearsal
10. Final production deployment

## Current blocker

The legacy Supabase project is not currently queryable through the available Supabase connection. Therefore source-to-target reconciliation cannot honestly be marked passed.

## Cutover policy

Do not switch production traffic while any mandatory gate above is unresolved.

## Rollback

Keep the legacy application/database untouched until post-cutover validation is complete. Production feature flags must remain disabled until the final acceptance gate is explicitly passed.
