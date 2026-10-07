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

## Current architecture

The V2 Practice engine uses the existing normal/legacy question bank as its single content source. V2 does not select from or load a separate V2 question pool in the browser.

When V2 mode is enabled:

1. Existing Practice selects the normal question bank using the same topic/status/adaptive pipeline.
2. The learner-facing V2 state is populated from that normal bank with `correct_answer` removed.
3. A V2 practice session is created for the selected question IDs.
4. Answers and confidence are sent through the V2 attempt boundary.
5. V2 remains responsible for authenticated session ownership and server-authoritative correctness.
6. Legacy remains the rollback path.

The V2 content tables are no longer a question-selection source for Practice. They should be treated as migration-era backing data until the V2 database schema is fully decoupled from question-content storage.
