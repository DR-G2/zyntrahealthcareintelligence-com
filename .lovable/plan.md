

## Plan: Fix Admin Grant Access

### Root Cause
The `admin-grant-access` edge function uses `supabase.auth.getUser(token)` with the **service role client**. This triggers a session lookup that fails with "Session not found" (visible in auth logs). The `admin-list-users` function works because it uses `getClaims(token)` instead.

### Changes

#### 1. Fix `supabase/functions/admin-grant-access/index.ts`
- Switch auth from `getUser(token)` to `getClaims(token)` pattern (matching `admin-list-users`)
- Create an anon client for auth verification, keep service role client for data operations

#### 2. Fix `src/pages/AdminDashboard.tsx` (lines 83-86, 98-101)
- `supabase.functions.invoke` returns `{ data, error }` where `error` is only for network/transport failures. If the function returns HTTP 403/500, the response body lands in `data`, not `error`.
- Add check: if `data?.error` exists, throw it as an error so the toast displays the actual message.

### Summary
Two small fixes: align the auth pattern in the edge function, and surface backend errors properly in the frontend.

