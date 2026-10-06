# Zyntra V2 Phase 12: Practice Cutover Test

The Practice page now uses the V2 learner-safe question payload when the V2 feature flag is enabled.

## V2 active-drill contract

- Practice creates a V2 session.
- Practice loads the session question payload through get_practice_session_questions().
- The active V2 question object has no correct_answer.
- V2 save_attempt() determines correctness server-side.
- Legacy user_attempts insertion is skipped in V2 mode.
- V2 completion occurs before V2 results are requested.
- get_practice_session_results() only returns results for a completed session.
- correct_answer is returned only by the completed-session result RPC.

## Rollback

Set:

VITE_SUPABASE_V2_PRACTICE_ENABLED=false

The legacy Practice path remains available.

## Test checklist

1. Sign in with a disposable test account.
2. Enable VITE_SUPABASE_V2_PRACTICE_ENABLED=true in the deployment environment.
3. Start a small Practice session.
4. Confirm questions render normally.
5. Select answers and confidence values.
6. Complete the session.
7. Confirm results and explanations render.
8. Confirm the V2 session is completed.
9. Confirm V2 attempts exist and is_correct matches the server-calculated answer.
10. Confirm no duplicate legacy attempt rows are created for the V2 session.
11. Resume an interrupted V2 session and confirm the same V2 session ID is reused.
12. Turn the feature flag off and confirm the legacy flow remains functional.

No production-wide cutover should be considered complete until these checks pass on a disposable account.
