# Zyntra V2 Phase 11: Controlled Practice Bridge

Phase 11 connects the existing Practice UI to the V2 session and attempt system behind an explicit feature flag.

## Feature flag

Set:

VITE_SUPABASE_V2_PRACTICE_ENABLED=true

Only then does Practice create and use a V2 practice session.

If the variable is absent or false, the existing Practice path remains unchanged.

## Bridge architecture

Existing question selection remains temporarily on the legacy client because the current Practice UI still uses the legacy question shape and adaptive ranking.

When V2 mode is enabled:

1. Existing Practice selects its question pool.
2. A V2 practice session is created with those question IDs.
3. The V2 session ID is stored with the existing resumable session.
4. Answers and confidence are sent through V2 save_attempt.
5. V2 calculates correctness on the server.
6. The V2 session is completed only after V2 attempt writes succeed.
7. Existing Practice result rendering remains intact during the migration bridge.

This is deliberately a bridge, not the final architecture.

## Resume

The legacy resumable session stores v2SessionId. On resume, Practice calls resumeV2PracticeSession and continues the same V2 session.

## Safety

The production route is not forced onto V2 by default.

The V2 RPCs are authenticated-only and do not expose correct_answer.

No Supabase service-role key belongs in the browser or repository.

## Next phase

The final cutover should move question delivery itself from the legacy questions table to get_practice_session_questions(), remove client-side correct-answer dependency from the active drill, and then retire the legacy Practice write path after validation.
