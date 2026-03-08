

## Plan: Rename to "Feed" (not "Recall"), Restructure Navigation under APPE, and Update Introduction Flows

### 1. Sidebar Navigation Restructure

**File: `src/components/AppSidebar.tsx`**

Rename "Analytics" → **APPE**. Move Trust Your Gut and Mistake Review into it. Add "Feed" (the paste-and-generate feature). Remove them from Learn & Practice.

```text
Learn & Practice
├── MCQ
├── OSCE
├── Questions (MCQ / OSCE)

APPE
├── Feed (new — paste content, generate MCQs or stations)
├── Diagnostic (MCQ / OSCE)
├── Performance
├── Behavior
├── Trust Your Gut (moved)
├── Mistake Review (moved)

Study Companion
├── AI Chat
├── Study Plan
├── Social Groups
├── Shared Tests
```

### 2. Feed Page (renamed from "Recall Feed")

**New file: `src/pages/Feed.tsx`**

- Two tabs: **MCQ** and **OSCE**
- MCQ tab: paste content → AI generates structured MCQ questions with options, correct answers, explanations → practice inline
- OSCE tab: paste scenario → AI generates a full station → launch directly
- Small muted footer: *"Also used by Zyntra for internal content development."*
- Gated to paid tiers (`canAccessAnalytics`)
- Route: `/feed`

### 3. Edge Function

**New file: `supabase/functions/feed-to-questions/index.ts`**

- Accepts `{ content_text, type: 'mcq' | 'osce', subject? }`
- MCQ: returns structured array of questions (question_text, options, correct_answer, explanation, category, difficulty)
- OSCE: returns station data matching existing station schema
- Uses `google/gemini-3-flash-preview`

### 4. Database

**New table: `feed_submissions`**
```sql
CREATE TABLE public.feed_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_text text NOT NULL,
  feed_type text NOT NULL DEFAULT 'mcq',
  subject text,
  generated_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: users own rows only
```

### 5. Welcome Tour Update

**File: `src/components/WelcomeTour.tsx`**

Update the tour steps to reflect the new feature set:

1. **Welcome to Zyntra** — intro (unchanged)
2. **Diagnostic Assessment** — MCQ & OSCE diagnostics (unchanged)
3. **Practice Drills** — MCQ drills (unchanged)
4. **Clinical Stations (OSCE)** — AI patient practice (unchanged)
5. **Feed** (new) — "Paste any clinical content and we'll generate practice questions or stations from it instantly."
6. **APPE Analytics** (updated) — "Track your performance, behavior patterns, mistake trends, and gut instinct accuracy — all in one place."
7. **AI Study Companion** — chat, study plan (unchanged)
8. **You're All Set!** — closing (unchanged)

### 6. Landing Page Update

**File: `src/pages/Landing.tsx`**

Update the "How It Works" section to include a 5th step for Feed, and update the features grid to mention Feed capability. Update "APPE Stages" heading.

### 7. Dashboard Update

**File: `src/pages/Dashboard.tsx`**

Replace the "Mistake Review" quick-action card with a "Feed" card linking to `/feed` — "Paste clinical content and generate practice questions instantly."

### 8. Route Registration

**File: `src/App.tsx`**

Add `/feed` route pointing to the new Feed page.

### Files Changed

| File | Change |
|------|--------|
| `src/components/AppSidebar.tsx` | Rename Analytics → APPE; move items; add Feed link |
| `src/pages/Feed.tsx` | New page — paste content, generate MCQs/stations |
| `supabase/functions/feed-to-questions/index.ts` | New edge function |
| `src/components/WelcomeTour.tsx` | Update steps for new features |
| `src/pages/Landing.tsx` | Update features & stages |
| `src/pages/Dashboard.tsx` | Replace Mistake Review card with Feed card |
| `src/App.tsx` | Add `/feed` route |
| **Migration** | Create `feed_submissions` table with RLS |

