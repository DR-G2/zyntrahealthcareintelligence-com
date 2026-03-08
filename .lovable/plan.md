

## Plan: Comprehensive User Activity Dashboard

### What Changes

Transform the "Live Activity" tab from showing only currently-online users into a full **User Activity** dashboard that displays all users with their complete historical stats since signup, plus a real-time online indicator.

### Changes

#### 1. Update Edge Function: `supabase/functions/admin-live-stats/index.ts`

- Remove the requirement for `user_ids` in the request body — instead fetch **all** profiles
- Remove the "today only" filter — aggregate **all-time** stats per user:
  - `total_questions`: total MCQ attempts ever
  - `total_correct`: total correct answers ever
  - `overall_accuracy`: percentage
  - `total_osce`: total OSCE station attempts ever
  - `streak_days`: from user_progress
  - `questions_today` / `osce_today`: keep today's stats as a secondary metric
  - `last_active`: from user_progress or last attempt
  - `joined_at`: from profiles.created_at
- Return all users sorted by last activity

#### 2. Rewrite Component: `src/components/admin/LiveActivityTab.tsx`

- Rename display to "User Activity" (keep component name for compatibility)
- Fetch all user stats on mount via the updated edge function (no longer depends on presence)
- Fetch presence separately to overlay online status (green dot) on matching users
- Display as a **table** (not cards) with columns:
  - Name/Email | Online | Total MCQs | All-time Accuracy | Total OSCE | Streak | Today MCQs | Today OSCE | Last Active | Joined
- Add search/filter input
- Keep the Refresh and Retrain AI buttons
- Online users get a green dot badge; offline users show nothing
- Sort by: online first, then by last active descending

#### 3. Update Admin Tab Label

In `src/pages/AdminDashboard.tsx`, change the tab trigger label from "Live Activity" to "User Activity" (the icon and value stay the same).

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/admin-live-stats/index.ts` | Fetch all users, all-time + today stats |
| `src/components/admin/LiveActivityTab.tsx` | Table layout, search, online overlay |
| `src/pages/AdminDashboard.tsx` | Tab label update |

No database migrations needed.

