# Zyntra V2 Phase 9: Practice Compatibility Boundary

## Purpose

Phase 9 starts the controlled bridge from the existing Practice flow to the V2 database.

The first boundary is deliberately narrow:

**answer + confidence + telemetry -> V2 save_attempt()**

The existing /practice route is not switched to V2 by this phase.

## What was added

src/lib/migration/v2-practice-adapter.ts

This exposes saveAttemptToV2() and maps the current Practice telemetry into the V2 public.save_attempt() RPC.

The V2 database function is responsible for requiring an authenticated user, checking ownership of the V2 practice session, validating confidence from 1 to 5, and writing the attempt using the authenticated user's ID.

The adapter requires a V2 practice_sessions.id. A legacy active_sessions.id must never be passed to it.

## V2 database status

Verified on the new V2 Supabase project:

- public.save_attempt() exists with the expected 16-argument contract.
- create_practice_session() is not yet present.
- resume_practice_session() is not yet present.
- complete_practice_session() is not yet present.

Therefore this phase does not try to create or complete V2 sessions.

## Safety

The V2 client was changed to lazy initialization. V2 environment variables are only required when migration code actually calls the V2 client.

The production Practice route continues using the legacy Supabase client.

No production user flow was switched.

## Next gate

Before /practice can use V2:

1. Add and verify V2 practice-session lifecycle RPCs.
2. Create a V2 session from the selected Practice configuration.
3. Present V2 learner-safe question data.
4. Grade answers without exposing correct_answer to the browser.
5. Save each answer through save_attempt().
6. Verify confidence and telemetry.
7. Verify resume and complete behavior.
8. Test with a disposable account.
9. Only then introduce a small controlled V2 cohort flag.

The learner-safe question view intentionally omits correct_answer. That is a security boundary, not a missing field.
