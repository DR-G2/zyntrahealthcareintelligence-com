

## Plan: Save/Bookmark, History, Learning Points & Notes for MCQ and OSCE (Paid Only)

### Summary

Add bookmark/save functionality to MCQ questions and OSCE stations, restrict history access and learning points to paid tiers, and add a note-taking system for both question types. Free users see an upgrade prompt instead.

### Feature Gate Changes

**File: `src/hooks/useFeatureGate.ts`**
- Add two new flags: `canSaveBookmarks: boolean` and `canAccessNotes: boolean`
- Paid tiers (full_access, lifetime, mcq_only, osce_only) → `true`
- Free tier → `false`

### MCQ: Save/Bookmark + Notes

**File: `src/components/practice/QuestionExplanation.tsx`**
- Add a Bookmark (heart/star) toggle button in the header — calls `bookmarks` table insert/delete
- Add a Notes section (textarea) below the explanation — loads from `user_notes` table, auto-saves on blur
- Both gated behind `canSaveBookmarks` / `canAccessNotes` — show lock icon + upgrade prompt for free users
- Show "Learning Points" (key_takeaways) section prominently — gated to paid only

**File: `src/pages/Practice.tsx` (ResultsScreen)**
- Add bookmark toggle on each review question card
- Gate the "Review Questions" section's detailed explanations to paid users (free users see truncated view + upgrade prompt)

### OSCE: Save Station + Notes

**File: `src/pages/Stations.tsx` (results phase)**
- Add a "Save Station" bookmark button that inserts into a new `station_bookmarks` table
- Add a notes textarea that saves to `station_notes` table
- Both gated to paid tiers

**File: `src/components/stations/StationResults.tsx`**
- Add bookmark + notes UI within the results view
- Show learning points (recommendations) section — already present but will gate to paid

### Database Changes

**New table: `station_bookmarks`**
```sql
CREATE TABLE public.station_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  station_attempt_id uuid NOT NULL REFERENCES station_attempts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, station_attempt_id)
);
ALTER TABLE public.station_bookmarks ENABLE ROW LEVEL SECURITY;
-- RLS: users own rows only (SELECT, INSERT, DELETE)
```

**New table: `station_notes`**
```sql
CREATE TABLE public.station_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  station_attempt_id uuid NOT NULL REFERENCES station_attempts(id) ON DELETE CASCADE,
  note_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, station_attempt_id)
);
ALTER TABLE public.station_notes ENABLE ROW LEVEL SECURITY;
-- RLS: users own rows only (SELECT, INSERT, UPDATE, DELETE)
```

Existing `bookmarks` and `user_notes` tables already handle MCQ — no schema changes needed there.

### History Pages (Paid Gate)

**File: `src/pages/QuestionsOSCE.tsx`**
- Gate the entire page behind `canAccessAnalytics` (paid) — free users see upgrade prompt

**File: `src/pages/MistakeReview.tsx`**
- Gate behind paid tier — free users see upgrade prompt with "Upgrade to review past mistakes"

### Saved Items View

**File: `src/pages/Questions.tsx`** (or new `src/pages/SavedItems.tsx`)
- Add a "Saved" tab to the Questions page showing bookmarked MCQs and saved OSCE stations
- Each item shows the question/station title, category, date saved, and a link to view the full explanation/notes

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useFeatureGate.ts` | Add `canSaveBookmarks`, `canAccessNotes` flags |
| `src/components/practice/QuestionExplanation.tsx` | Add bookmark toggle, notes textarea, gate learning points |
| `src/pages/Practice.tsx` | Add bookmark on review cards |
| `src/pages/Stations.tsx` | Add bookmark + notes in results phase |
| `src/components/stations/StationResults.tsx` | Add bookmark/notes UI, gate recommendations |
| `src/pages/QuestionsOSCE.tsx` | Gate to paid tier |
| `src/pages/MistakeReview.tsx` | Gate to paid tier |
| `src/pages/Questions.tsx` | Add "Saved" tab for bookmarked MCQs + stations |
| **Migration** | Create `station_bookmarks` and `station_notes` tables with RLS |

