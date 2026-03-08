

## Plan: Fix Admin Presence Visibility

### Root Cause

`LiveActivityTab` fetches online status via a **client-side** query to `user_presence` (line 45). The RLS policy on that table restricts reads to `auth.uid() = user_id`, so the admin only sees their own row. Result: `onlineSet` is always empty or contains only the admin's own ID, showing 0 online users.

### Solution

Move the presence query into the `admin-live-stats` edge function, which already uses the **service role key** (bypasses RLS). Return `online_user_ids` alongside `stats`.

### Changes

#### 1. `supabase/functions/admin-live-stats/index.ts`
- After existing parallel queries, add a query for `user_presence` where `is_online = true`
- Include the result as `online_user_ids: string[]` in the response JSON

#### 2. `src/components/admin/LiveActivityTab.tsx`
- Remove the separate client-side `supabase.from('user_presence')` query
- Instead, read `online_user_ids` from the edge function response to build `onlineSet`
- Simplify `fetchAll` to only call the edge function + training context query

| File | Change |
|------|--------|
| `supabase/functions/admin-live-stats/index.ts` | Add presence query, return `online_user_ids` |
| `src/components/admin/LiveActivityTab.tsx` | Use edge function response for online status |

