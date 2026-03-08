## Plan: Simplify Practice Drills — 2 Modes + Custom Config + Performance DNA

### Overview

Replace the current 3-drill-mode system with 2 modes. Add a setup screen where candidates pick their mode, topics, and question count. After each session, update the `performance_profiles` table with per-category accuracy to build a strength/weakness DNA.

### 1. Replace DrillSelector with a Setup Screen

**File:** `src/pages/Practice.tsx`

Remove the 3 hardcoded drill configs (speed, commitment, pressure). Replace with:

**Two modes:**

- **Recharge Answer** — candidates can change their answer before moving on (like current `canChangeAnswer: true`)
- **No Change** — answer locks immediately on selection (like current `canChangeAnswer: false`)

**Setup form (before starting):**

- Mode selector: two cards/radio buttons for the two modes
- Topic selector: multi-select checkboxes listing all 19 AMC categories (fetched via `SELECT DISTINCT category FROM questions`). "All Topics" toggle.
- Question count: slider or select dropdown (options: 10, 20, 30, 50)
- Time auto-calculated: 1 min per question (configurable)

**Route change:** `/practice` shows the setup screen. `/practice/session` runs the drill (pass config via state). Remove `/practice/:type` pattern.

### 2. Update DrillSession

- Accept mode config from the setup screen (via React Router state or a context/parent state).
- Fetch questions filtered by the selected categories: `.in('category', selectedTopics)`.
- Timer based on question count × 1 min.
- `canChangeAnswer` driven by the selected mode.
- Everything else (answer tracking, time tracking, answer changes count) stays the same.

### 3. Performance DNA — Post-Session Update

After `handleFinish`, in addition to inserting `user_attempts`, compute per-category stats and update `performance_profiles`:

- Group results by `category` → calculate accuracy per category.
- Identify weak categories (< 60% accuracy) and strong categories (> 80%).
- Update `performance_profiles` for the user:
  - `clinical_accuracy`: overall session accuracy blended with existing value (weighted average).
  - `stability_score`: derived from `answer_changes_count` (fewer changes = higher stability). Only relevant in Recharge mode.
  - `confidence_gap`: difference between categories the user is strong vs weak in.
- Also update `profiles.weak_areas` with categories where accuracy < 60%.

This uses existing tables — no schema changes needed.

### 4. Results Screen Enhancement

After drill completion, show:

- Overall score (existing)
- Per-category breakdown: a small table or bar chart showing accuracy by topic
- Strength/weakness summary: "Strong in Cardiology, Weak in Dermatology"
- Review questions (existing)

### File Changes


| File                     | Action                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/pages/Practice.tsx` | Rewrite: 2 modes, setup screen with topic/count selectors, performance DNA update                 |
| `src/App.tsx`            | Update route from `/practice/:type?` to `/practice` (single route, internal state manages phases) |


No database migrations needed — all required columns exist.