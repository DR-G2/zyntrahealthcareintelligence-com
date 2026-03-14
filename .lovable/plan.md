

## Plan: Add History Tabs to MCQ and OSCE Pages

The user wants history (past attempts) accessible directly within the MCQ practice page and the OSCE stations page, rather than as a separate global route.

### What exists today
- `QuestionHistory.tsx` — standalone page showing MCQ attempt history from `user_attempts` table (currently redirects `/history` → `/practice`)
- `station_attempts` table — stores OSCE attempt data (subject, scores, mode, time, psychograph, etc.) but no history UI exists for it
- MCQ page (`Practice.tsx` or `Questions.tsx`) and OSCE page (`Stations.tsx`) have no history tabs

### Changes

**1. Add a "History" tab to `src/pages/Practice.tsx` (MCQ page)**
- Add a top-level tab or button that toggles between "Practice" and "History" views
- Embed the history logic from `QuestionHistory.tsx` inline (query `user_attempts` with the same filters: correct/incorrect, category, search, pagination)
- Reuse existing UI patterns (cards with badges, expandable explanations)

**2. Add a "History" tab to `src/pages/Stations.tsx` (OSCE page)**
- When phase is `mode-select`, add a "History" button/tab alongside the mode cards
- Query `station_attempts` for the current user, ordered by `created_at desc`
- Display: subject, mode badge, scores summary, time taken, date
- Expandable detail showing psychograph data if available

**3. Route cleanup in `App.tsx`**
- Keep `/history` redirect to `/practice` (no change needed)

**4. Feature gate**
- Both history sections gated behind `gate.canAccessHistory` (already exists in the hook)

### Files

| File | Change |
|------|--------|
| `src/pages/Practice.tsx` | Add History tab with embedded MCQ attempt history |
| `src/pages/Stations.tsx` | Add History tab in mode-select phase with OSCE attempt history |
| `src/pages/QuestionHistory.tsx` | Keep as-is (legacy route still redirects) |

