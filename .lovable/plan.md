

## Problem

The diagnostic assessment (Assess.tsx) and performance profile are not synced because:

1. **Assess.tsx never saves to the database.** It calculates performance scores and passes them via React Router `navigate('/profile', { state: { performanceData } })` — purely in-memory. No writes to `performance_profiles` or `user_attempts` tables.

2. **Profile.tsx only reads from `location.state`.** If you navigate away and come back, the data is gone. It never queries `performance_profiles` from the database.

3. **Practice.tsx does save** to both `user_attempts` and `performance_profiles` — but the diagnostic does not.

This means: diagnostic results vanish on page refresh, study plan generation has no data to work with, and the performance profile page shows "No Performance Profile Yet" unless you just came from the diagnostic.

## Changes

### 1. Update `src/pages/Assess.tsx` — Save results to database

After calculating performance scores in `handleSubmit`:
- Save each question attempt to `user_attempts` (with `session_id`, `question_id`, `selected_answer`, `is_correct`, `time_taken_seconds`, `answer_changes_count`)
- Upsert performance profile to `performance_profiles` (same blend logic Practice.tsx uses — if existing profile exists, blend scores rather than overwrite)
- Need to import `useAuth` to get user ID and `supabase` client

### 2. Update `src/pages/Profile.tsx` — Load from database with state fallback

- On mount, fetch from `performance_profiles` table for the current user
- Use `location.state` as immediate display data (for fresh diagnostic results), but always load/merge from database
- Show the database data when no state is passed (e.g., navigating directly to `/profile`)
- Import `useAuth` and `supabase`

### File Changes

| File | Change |
|------|--------|
| `src/pages/Assess.tsx` | Add DB writes: `user_attempts` inserts + `performance_profiles` upsert in `handleSubmit` |
| `src/pages/Profile.tsx` | Add DB read: fetch `performance_profiles` on mount, fallback to `location.state` |

