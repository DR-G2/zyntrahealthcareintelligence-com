

## Plan: Reset Test Account Edge Function

### New File: `supabase/functions/admin-reset-test-user/index.ts`
- Admin-gated edge function (same email check pattern)
- Deletes existing `testuser123@zyntr.website` user via `supabase.auth.admin.listUsers()` + `deleteUser()`
- Also deletes related profile/data rows
- Recreates user with `supabase.auth.admin.createUser({ email, password: "gNs@2304", email_confirm: true })`
- Returns success with credentials confirmation

### Edit: `supabase/config.toml`
- Add `[functions.admin-reset-test-user]` with `verify_jwt = false`

### Result
After deployment, invoke the function once to get a fresh `testuser123@zyntr.website` account with password `gNs@2304`, ready to log in immediately.

