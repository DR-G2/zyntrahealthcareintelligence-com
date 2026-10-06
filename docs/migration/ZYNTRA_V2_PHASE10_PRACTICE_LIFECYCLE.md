# Zyntra V2 Phase 10: Practice Session Lifecycle

Phase 10 adds the V2 Practice session boundary without switching the production Practice route.

## Lifecycle

1. create_practice_session
2. get_practice_session_questions
3. save_attempt
4. resume_practice_session
5. complete_practice_session

## Security model

The browser receives the question stem, options and learning metadata, but never receives questions.correct_answer.

The save_attempt RPC calculates correctness on the server from questions.correct_answer. The p_is_correct argument remains for compatibility with the existing adapter but is intentionally ignored for grading.

Every session RPC verifies auth.uid() and the relevant session ownership.

The lifecycle functions use SECURITY DEFINER because the learner-facing database role must not have direct access to the protected questions.correct_answer column. They use a fixed search_path and explicit authenticated-only EXECUTE grants.

Anonymous EXECUTE was explicitly revoked from all five RPCs.

## Frontend boundary

src/lib/migration/v2-practice-session.ts provides the client adapter for session creation, question loading, resume and completion.

The production /practice route is still not connected to these functions.

## Important limitation

The new V2 questions table is intentionally leaner than the legacy question model. Phase 10 returns the fields that currently exist in V2:

- zyntra_id
- stem
- options
- explanation
- subject_id
- subtopic_id
- difficulty_tier
- version

Legacy-only fields such as diagnosis_explanation and first_line_investigation are not fabricated into V2.

## Verification

Live V2 verification confirmed all five RPC signatures exist.

Live privilege verification confirmed the five RPCs are executable by authenticated users and not by anon.

The Supabase security advisor reports the SECURITY DEFINER functions as warnings. These are intentional for this boundary because they are the controlled server-side path to protected answer data. The functions enforce authentication, session ownership, question membership and a fixed search_path.

The existing seven SECURITY DEFINER view findings remain unchanged from the earlier V2 security review and are separate from this phase.
