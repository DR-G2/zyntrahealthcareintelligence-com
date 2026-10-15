# Fix: Practice Focus Areas empty, counts zero, filters ignored

## Confirmed so far (from code)
- `Practice.tsx` loads subjects, subtopics and question metadata from V2 in one block; any failure (bridge, query, RPC) is caught and only logged, so the page shows an empty panel, all zeros and "Select at least one subject or subtopic" instead of an error.
- History errors are also swallowed (`.catch(() => [])`), so status counts can be wrong while looking valid.
- Subtopic counts are keyed by subtopic name only, so same-named subtopics under different subjects merge.
- `ensureV2Session()` builds the bridge URL from `import.meta.env.VITE_SUPABASE_V2_URL` directly, while the V2 client has its own fallback; the two can disagree.
- The root runtime failure is not yet confirmed (no preview logs captured). Step 1 confirms it.

## Steps
1. **Diagnose live (read-only).** Signed-in Playwright run on `/practice`: record each failing request (status, error code), check the bridge call, subjects/subtopics queries, metadata RPC grant and output, and whether returned subject/subtopic IDs match V2 records. Read-only V2 queries for row counts and function grants. No tokens logged.
2. **One V2 config source.** Add a small shared module exporting the V2 URL and publishable key (with the single approved fallback); use it in `v2-client.ts` and the bridge call. Keep JWT check, email match and sign-out of mismatched V2 sessions. Handle expired legacy session with a clear "sign in again" message.
3. **Reliable loading in Practice.tsx.** Separate error state with Retry button (no reload); stale-request guard; count by subject/subtopic ID (keys `subjectId::subtopicId` for counts); keep search, expand/collapse, Select/Clear All, focus links. History failure shows "history unavailable" instead of fake zeros. Status counts: All = active pool, Attempted = distinct questions, Not Attempted = All - Attempted, Correct/Incorrect from latest attempt.
4. **Server-enforced filters.** Current contract (labelled in UI) is browse-only and `pie_create_session` has no topic parameters. Your request says filters should limit the drill, so: new additive V2 migration adding optional `p_subject_ids uuid[]`, `p_subtopic_ids uuid[]` to `pie_create_session` (and passed through to the selector), keeping auth, active-status, caps, audit and answer-key rules. Browser sends only topic IDs, never question IDs. If filters leave zero eligible questions, the server says so plainly. Remove the browse-only notice once enforced. SQL shown for approval before applying to V2; rollback copy saved.
5. **Tests** (vitest, mocked deps): fallback URL, expired session, bridge failure, subjects/subtopics/RPC failures, pagination at exact page size, ID mapping counts, empty pool, retry, latest-attempt counting, user isolation, select/clear, filter IDs reaching session start, both MCQ modes + mock, no key/explanation before completion. Plus a SQL test of the new filter inside a rolled-back transaction.
6. **Validate.** Tests, typecheck, lint, build; signed-in browser run: filters populate, counts non-zero, pick a subtopic, start short drill, every question in that subtopic, confidence required, change mode respected, finish and view results, refresh, check console/network.

## Safety
No question, LO, mapping or status changes. No RLS/JWT relaxation, no secrets in frontend. Migration additive only, applied to V2 only after you approve the SQL. No publish without your say. I can't open a pull request or give a merge SHA from here; changes sync to GitHub automatically.
