

## Plan: Session Persistence, Question History, Auto-Save, Resume Test, OSCE Performance, Admin User Inspection

This is a large multi-feature implementation spanning session management, progress tracking, auto-save/resume, performance optimization, and admin tooling.

---

### 1. Remember Me Login Option

**File: `src/pages/Login.tsx`**
- Add a `rememberMe` checkbox state to the login form
- Store the preference in `localStorage` before calling `signIn`
- In `src/contexts/AuthContext.tsx`, read the preference and configure the Supabase client's `auth.persistSession` accordingly

**Note:** Supabase already uses `persistSession: true` with refresh tokens by default, so sessions persist across browser restarts. The "Remember Me" toggle will control whether we explicitly clear the session on browser close by using `sessionStorage` vs `localStorage`:
- **Remember Me ON** (default): Use `localStorage` (current behavior — sessions persist)
- **Remember Me OFF**: Switch auth storage to `sessionStorage` (session dies when browser closes)

**File: `src/integrations/supabase/client.ts`** — Cannot edit (auto-generated). Instead, we'll handle this in AuthContext by calling `supabase.auth.signOut()` on page unload when Remember Me is off, or by creating a wrapper that manages storage.

**Revised approach:** Since we can't edit the client file, we'll implement this by:
- Storing `rememberMe` preference in localStorage
- On app load in AuthContext, if `rememberMe` is false, check if this is a new browser session (using sessionStorage flag) and sign out if it is
- On logout, clear the rememberMe flag

---

### 2. Question Attempt History Page

**New file: `src/pages/QuestionHistory.tsx`**

A dedicated page at `/history` showing all `user_attempts` with joined question data.

Features:
- Query `user_attempts` joined with `questions` table (already done in MistakeReview — extend pattern)
- Display: question text, selected answer, correct answer, explanation, time taken, date/time, answer changes count
- Filters: subject (category), correct/incorrect, date range
- "Review Incorrect" filter preset button
- Paginated with 20 items per page using cursor-based pagination

**Files:** `src/pages/QuestionHistory.tsx` (new), `src/App.tsx` (add route), `src/components/AppSidebar.tsx` (add nav item)

---

### 3. Auto-Save Answers During Practice

**File: `src/pages/Practice.tsx`**

Currently answers are only saved in `doFinish()`. Changes:
- Create a new DB table `active_sessions` to store in-progress test state
- On each answer selection (`selectAnswer`), upsert the current session state to `active_sessions`
- Store: `user_id`, `session_id`, `config` (JSON), `questions` (JSON array of IDs), `selected_answers` (JSON), `answer_changes` (JSON), `question_times` (JSON), `current_index`, `time_remaining`, `updated_at`
- On session completion (`doFinish`), delete the `active_sessions` row

**Database migration:**
```sql
CREATE TABLE public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL UNIQUE,
  session_type text NOT NULL DEFAULT 'mcq',
  config jsonb NOT NULL DEFAULT '{}',
  question_ids jsonb NOT NULL DEFAULT '[]',
  answers jsonb NOT NULL DEFAULT '{}',
  answer_changes jsonb NOT NULL DEFAULT '{}',
  change_sequences jsonb NOT NULL DEFAULT '{}',
  question_times jsonb NOT NULL DEFAULT '{}',
  time_to_first_click jsonb NOT NULL DEFAULT '{}',
  pause_events jsonb NOT NULL DEFAULT '{}',
  current_index integer NOT NULL DEFAULT 0,
  time_remaining integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON public.active_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

### 4. Resume Interrupted Test

**File: `src/pages/Dashboard.tsx`**

- On mount, query `active_sessions` for the current user
- If an active session exists, show a "Resume Your Last Session" card with question progress info
- Clicking "Resume" navigates to `/practice` with a query param `?resume=SESSION_ID`

**File: `src/pages/Practice.tsx`**

- On mount in `DrillSession`, check for `resume` query param
- If present, load session state from `active_sessions` and restore: questions (re-fetch by IDs), answers, current index, time remaining
- Show toast: "Your previous session has been restored successfully."

---

### 5. OSCE Loading Performance

**File: `src/pages/Stations.tsx`**

Optimizations:
- Add React Query caching for station data with `staleTime: 5 * 60 * 1000`
- Prefetch next station content during current station
- Memoize heavy components with `React.memo`
- Use `useMemo` for computed values already being recalculated

**File: `supabase/functions/generate-station/index.ts`**
- Add cache headers to response

---

### 6. Admin User Inspection Panel

**New file: `src/components/admin/UserInspectionPanel.tsx`**

A slide-out panel (Sheet) that opens when admin clicks a user row.

Sections:
- **Profile Details**: name, email, country fields, graduation info, exam stage, joined date, last login (from `user_presence`)
- **Activity Analytics**: total questions, today's questions, accuracy %, subject-wise performance, avg response time, answer stability, confidence calibration (from `user_attempts` + `performance_profiles` + `behavior_profiles`)
- **Question History**: paginated list of attempts with filters (subject, date, correct/incorrect)
- **Behavioral Signals**: archetype, rushing/hesitation/fatigue patterns (from `behavior_profiles`)

**New edge function: `supabase/functions/admin-inspect-user/index.ts`**

Returns comprehensive user data for admin inspection:
- Profile fields (including new demographics)
- Aggregated attempt stats (total, by subject, by date)
- Recent attempts with question details
- Behavior profile data
- Performance profile data
- Presence/session data

---

### 7. Admin Monitoring Tools

**File: `src/components/admin/LiveActivityTab.tsx`**

Add new summary cards at the top:
- Active sessions count (from `active_sessions` table)
- Auto-save recovery events (count of sessions restored — track via a flag on `active_sessions`)
- Platform uptime metrics

**File: `supabase/functions/admin-live-stats/index.ts`**

Add queries for:
- `active_sessions` count
- Aggregate session recovery stats

---

### Files Changed Summary

| File | Change |
|------|--------|
| **Database migration** | Create `active_sessions` table |
| `src/pages/Login.tsx` | Add Remember Me checkbox |
| `src/contexts/AuthContext.tsx` | Handle Remember Me session logic |
| `src/pages/QuestionHistory.tsx` | **New** — full attempt history page |
| `src/pages/Practice.tsx` | Auto-save on answer select, resume from active session |
| `src/pages/Dashboard.tsx` | Resume session card |
| `src/pages/Stations.tsx` | React Query caching, prefetching |
| `src/components/admin/UserInspectionPanel.tsx` | **New** — admin user detail panel |
| `supabase/functions/admin-inspect-user/index.ts` | **New** — user inspection data endpoint |
| `src/components/admin/LiveActivityTab.tsx` | Add monitoring cards |
| `supabase/functions/admin-live-stats/index.ts` | Add active session stats |
| `src/App.tsx` | Add `/history` route |
| `src/components/AppSidebar.tsx` | Add Question History nav item |
| `supabase/config.toml` | Register `admin-inspect-user` function |

### Implementation Order

1. Database migration (active_sessions table)
2. Remember Me login
3. Auto-save + Resume test (Practice.tsx + Dashboard.tsx)
4. Question History page
5. OSCE performance optimization
6. Admin user inspection panel + edge function
7. Admin monitoring additions

