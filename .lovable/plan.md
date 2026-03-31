
I investigated the current admin-only data portability flow and the import breakage. The fix should focus on reliability and observability, not just UI messaging.

1. Diagnose the real failure path
- The import UI calls `supabase.functions.invoke('import-learning-data', { body })` from `src/components/admin/DataPortabilityTab.tsx`.
- The edge function `supabase/functions/import-learning-data/index.ts` is fully synchronous and performs many sequential writes.
- It currently ignores many database write errors because most `upsert/insert/update` calls are not checked.
- That means the function can fail mid-run, return inconsistent responses, or surface as a generic function invocation error on the client.
- There are also no logs showing up, so the plan should improve in-function error reporting and history persistence.

2. Replace fragile admin auth with the project’s actual admin-role pattern
- The import/export functions currently rely on a hardcoded `ADMIN_EMAILS` array.
- Other admin functions in this repo use `admin_roles` in the backend.
- I would switch both `import-learning-data` and `export-learning-data` to the same role check pattern used elsewhere:
  - validate JWT in code
  - resolve caller email
  - check `admin_roles`
  - optionally restrict destructive import modes to `super_admin`
- This removes drift between frontend-only email checks and backend authorization.

3. Harden the import edge function so it returns deterministic JSON
- Refactor `import-learning-data` around explicit helper steps:
  - parse and validate request body
  - authorize admin
  - validate `target_user_id`
  - validate schema
  - fetch current snapshot
  - execute import branch
  - write history record
  - return structured result
- Every DB operation should be checked:
  - `const { error } = await ...`
  - if error, throw with table/step context
- Return a consistent JSON envelope for all outcomes:
  ```text
  {
    success: false,
    step: "subject_dna",
    error: "Failed to upsert subject row",
    details: "..."
  }
  ```
- This should eliminate the opaque “2xx error” experience and make failures actionable.

4. Reduce timeout and payload risk in the import flow
- The current import request sends the full exported dataset back to the function, including large arrays like `question_history`, `osce_history`, and `performance_trends`.
- But the current import logic only actually re-ingests a small subset:
  - `accuracy_metrics`
  - `behavioral_patterns`
  - `difficulty_mapping`
  - `clinical_reasoning_nodes.performance_profile`
- I would make the import path intentionally lightweight:
  - ignore large history arrays during apply mode
  - use them only for validation/preview counts if needed
  - optionally trim them client-side before sending the request
- This is the most likely fix for the “2xx/noncode” style failure if large payloads are causing function instability or delayed responses.

5. Add robust input validation and mode rules
- Validate:
  - `merge_mode` is one of `merge | replace`
  - `simulate` is boolean
  - `target_user_id` is a UUID when provided
  - imported JSON has the required schema and correct shapes
- Add protective rules:
  - `simulate` never writes
  - `replace` should be restricted to stronger admin privilege if desired
  - reject malformed `difficulty_mapping` rows instead of partially processing them silently

6. Fix history logging for admin usage
- `data_export_history` currently has user-scoped RLS, but imports are being done by admins for target users.
- Because the functions use service role, writes work, but the admin UI loads history directly from the client:
  - `supabase.from('data_export_history').select('*')`
- That client query is filtered by RLS to the signed-in admin’s own `user_id`, not the target user.
- I would change the history feature so admins can actually inspect the selected target user’s history via a secure backend function or a filtered admin endpoint instead of direct client reads.
- This also helps debugging because import/export runs become visible for the chosen user.

7. Improve the admin UI error handling
- In `DataPortabilityTab`, the current client only does:
  - `if (error) throw error`
  - `if (result?.error) ...`
- I would make the UI surface structured backend errors clearly:
  - failed step
  - validation details
  - target user mismatch
  - timeout/transport guidance
- Also add simple safeguards:
  - require target user ID for admin import/export
  - disable import until valid JSON + valid target UUID
  - show uploaded file size before submit
  - show “simulation only” and “apply” as clearly separate flows

8. Optional reliability upgrade if imports can still be large
- If you expect very large offline model files in future, I would move import to a job-style flow:
  - start import
  - store queued/processing/completed state
  - poll status from UI
- For the current codebase, I do not think a full queue is required yet if we first trim payloads and harden error handling.
- But I would structure the refactor so this can be added later without rewriting the UI.

9. Files I would update
- `supabase/functions/import-learning-data/index.ts`
  - main reliability/auth/error-handling fix
- `supabase/functions/export-learning-data/index.ts`
  - align admin authorization with backend role pattern
- `src/components/admin/DataPortabilityTab.tsx`
  - better validation, clearer errors, target-user enforcement, lighter request payload
- optionally add a small admin history function if needed:
  - `supabase/functions/...` for target-user history retrieval
- possibly one migration only if you want richer history fields, but likely not required for the core fix

10. Expected outcome after implementation
- No more opaque “2xx error” during import
- Admin-only authorization enforced consistently in backend
- Clear failure messages when schema or DB writes fail
- Lower chance of edge timeout because apply mode stops sending/processing unnecessary large arrays
- History/debug visibility becomes useful for the selected target user

Technical note on likely root causes
- Most probable: import function