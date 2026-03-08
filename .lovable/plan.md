

## Plan: Fix Shared Tests + Add Delete & Share

### Root Cause: Why Shared Tests Don't Work

The `shared_tests` table has a SELECT RLS policy that only allows **participants or creators** to view tests:
```sql
Using Expression: (is_test_participant(auth.uid(), id) OR (created_by = auth.uid()))
```

When a user tries to **join** a test by code, the `joinTest` function first does a SELECT to find the test by code. But since the user isn't a participant yet, **RLS blocks the query** and it returns null, showing "Invalid test code" even for valid codes.

### Changes

#### 1. Database Migration: Add RLS policy for joining by code
Add a new SELECT policy on `shared_tests` that allows any authenticated user to read a test if they know the code and it's open:
```sql
CREATE POLICY "Auth users can lookup open tests by code"
ON public.shared_tests
FOR SELECT
TO authenticated
USING (status = 'open');
```
This is safe because users still need the 6-character code to find a test, and it only exposes open tests.

#### 2. Update `src/pages/SharedTests.tsx`
- **Add delete functionality**: Add a delete button (trash icon) on each test card, visible only to the creator (`test.created_by === user.id`). On click, show a confirmation dialog, then delete from `shared_tests` (cascade will handle participants via RLS -- creator already has DELETE permission).
- **Add share functionality**: Add a share button next to the copy-code button. Uses `navigator.share` (Web Share API) if available, falling back to copying a message like "Join my test on Zyntra! Code: ABC123" to clipboard.
- **Add error logging**: Log actual Supabase errors in `createTest`, `joinTest`, and `loadTests` to help debug future issues.

### Files Changed

| File | Action |
|------|--------|
| Database migration | Add open-test SELECT policy |
| `src/pages/SharedTests.tsx` | Add delete, share, and better error handling |

