

## Plan: Trust Your Gut Training Module

### Overview
Create a dedicated `/trust-your-gut` page that analyzes first-instinct accuracy and helps users reduce harmful answer-changing behavior through stats, drills, and progress tracking.

### Data Foundation
The `user_attempts` table already tracks:
- `change_sequence` — ordered array of all selected answers (first element = first instinct)
- `time_to_first_click` — time before first selection
- `answer_changes_count` — total changes made
- `is_correct` — final correctness

We can derive first-instinct accuracy by comparing `change_sequence[0]` to the correct answer for questions where changes occurred.

### Page Sections

**1. First Instinct Stats Card**
- First-instinct accuracy % (across all attempts with changes)
- Final-answer accuracy % for comparison
- "Points lost by changing" count (changed from correct to wrong)
- Change rate trend over time (line chart)

**2. Change Analysis Breakdown**
- Table showing: Changed from correct → wrong, Changed from wrong → correct, Unnecessary changes (wrong → wrong)
- Per-category breakdown highlighting problem subjects

**3. Trust Training Mode**
A special practice drill mode:
- Questions appear with a 3-second "decision deadline" indicator (soft nudge)
- After answering, user must confirm or skip — no changing allowed
- Shows immediate feedback: "Your first instinct was correct/incorrect"
- Tracks improvement session over session

**4. Progress Timeline**
- Chart showing first-instinct accuracy and change rate over recent sessions
- Badges: "5 sessions streak with <10% change rate" etc.

### Technical Changes

**1. New page: `src/pages/TrustYourGut.tsx`**
- Fetches `user_attempts` with `change_sequence`
- Computes first-instinct stats by parsing sequences
- Renders stats cards, charts, and training mode toggle
- Training drill reuses practice session logic with modifications

**2. Route and navigation:**
- Add `/trust-your-gut` route in `App.tsx`
- Add nav item in `AppSidebar.tsx` (under Behavior section)

**3. No backend changes required** — all data already captured in `user_attempts`

### Result
Users see concrete data on how answer-changing hurts their score and can practice committing to first instincts in a dedicated training mode.

