

## AMC Behavior Analysis Engine — Full Implementation Plan

This is a large system spanning database changes, behavioral tracking, AI analysis, and a new dashboard. Here's the complete plan.

---

### 1. Database Schema Changes (Migration)

**Expand `user_attempts` table** with new columns:
- `time_to_first_click` (integer, seconds)
- `change_sequence` (jsonb, e.g. `["A","C","A"]`)
- `pause_events` (integer, count of >10s pauses)
- `time_of_day` (timestamptz)
- `question_position` (integer, position in block)
- `previous_question_correct` (boolean, nullable)

**New table: `question_difficulty_tiers`** — aggregate behavior stats per question:
- `question_id` (uuid, unique, FK to questions)
- `tier` (integer 1-5)
- `avg_time_seconds` (numeric)
- `change_rate` (numeric, 0-1)
- `correct_rate` (numeric, 0-1)
- `sample_size` (integer)
- `updated_at` (timestamptz)
- RLS: readable by authenticated users, no insert/update/delete from client

**New table: `behavior_profiles`** — per-user archetype + predictions:
- `user_id` (uuid, unique)
- `archetype` (text: panic_changer, rusher, paralyzer, strategist, fatigue_victim, subject_avoider)
- `archetype_signals` (jsonb — supporting data)
- `block_performance` (jsonb — Q1-20, Q21-40, Q41-60 stats)
- `subject_patterns` (jsonb — per-subject behavioral metrics)
- `trap_flags` (jsonb — detected AMC traps)
- `predicted_score_low` (integer)
- `predicted_score_high` (integer)
- `predicted_score_potential` (integer)
- `recommendations` (jsonb)
- `updated_at` (timestamptz)
- RLS: users can CRUD own rows

**Add `difficulty_tier` column to `questions` table** (integer, nullable, default null)

---

### 2. Enhanced Behavioral Tracking in Practice & Assess Pages

**`src/pages/Practice.tsx` and `src/pages/Assess.tsx`** — Add tracking for:
- **Time to first click**: Record timestamp on question load, capture first option click delta
- **Change sequence**: Store ordered array of selected options instead of just count
- **Pause detection**: Track periods >10s with no interaction using an interval timer
- **Question position**: Already tracked via `currentIndex`
- **Previous question outcome**: Pass from previous question's result
- **Time of day**: Captured at submission via `new Date()`

These metrics get saved alongside existing `user_attempts` insert. No new UI during the drill — purely background tracking.

---

### 3. AI-Powered Analysis Edge Function

**New: `supabase/functions/analyze-behavior/index.ts`**

Called after session completion (or on-demand from dashboard). Uses Lovable AI (gemini-3-flash-preview) with tool calling to return structured output:

- Fetches all `user_attempts` for the user
- Computes aggregate metrics: avg time, change rates, per-subject stats, fatigue curves, block segmented performance
- Classifies into one of 6 archetypes (Pattern A-F) based on signal thresholds
- Detects AMC-specific traps (most-appropriate paralysis, second-guessing success, rushing at end, distractor fixation, stem overload)
- Generates score predictions and recommendations
- Upserts into `behavior_profiles` table

The AI prompt includes the exact archetype definitions and signal thresholds from the spec.

---

### 4. Question Difficulty Tier Computation

**New: `supabase/functions/compute-question-tiers/index.ts`**

Batch job (called from admin or periodically):
- Queries all `user_attempts` grouped by `question_id`
- Computes per-question: avg_time, change_rate, correct_rate, sample_size
- Assigns tier 1-5 based on the behavioral signatures defined in the spec
- Upserts into `question_difficulty_tiers` and updates `questions.difficulty_tier`

---

### 5. Smart Question Sequencing

**Update `src/pages/Practice.tsx` (DrillSession)** and **`src/pages/Assess.tsx`**:

Implement the escalation rules:
- First 5 questions: Tier 1-2 only
- After 3 consecutive incorrect: insert Tier 1 confidence builder
- Questions 6-30: 60% Tier 2, 40% Tier 3
- Question 30: always Tier 2 (fatigue reset)
- Questions 31-55: Tier 3-4 dominant
- Questions 56-60: Tier 2-3 (prevent give-up)
- Never 3 consecutive same subject
- Target user's weak Tier 4 areas

This replaces the current random shuffle with a sequencing engine that pulls from `questions` joined with `question_difficulty_tiers`.

---

### 6. Real-Time Adaptive Interventions

During drill sessions, add lightweight intervention triggers:
- After 3 consecutive incorrect at Tier 1: switch to review mode prompt
- Change rate >50% in last 5 questions: show brief "Trust Your Gut" tooltip
- Pause >30 seconds: offer "Skip and Return" option
- Time per question increasing >20%: next 3 questions forced Tier 1-2

These are subtle UI nudges (toast or small banner), not blocking modals.

---

### 7. Behavior Dashboard Page

**New: `src/pages/BehaviorProfile.tsx`** (route: `/behavior`)

Displays the full analysis dashboard from Part 8 of the spec:

- **Archetype Badge**: Large display of detected pattern (e.g., "The Panic Changer") with icon and description
- **Block Performance Chart**: Bar/line chart showing Q1-20, Q21-40, Q41-60 segments with accuracy, time, and change rate using Recharts
- **Critical Finding Card**: Highlighted card with the key insight (e.g., "You lose 12 marks per block to answer changes")
- **Subject Weakness Table**: Per-subject breakdown showing whether weakness is behavioral (panic) or knowledge-based
- **Predicted Score Range**: Visual showing current predicted range and potential with fixes
- **Recommendations**: Actionable cards linking to relevant practice modes
- **AMC Trap Detection**: List of detected traps with explanations

Add link to this page from Profile page and sidebar navigation.

---

### 8. Wire It All Together

- **Post-session flow**: After Assess/Practice completion, call `analyze-behavior` edge function in background
- **Profile page**: Add "View Full Behavior Analysis" button linking to `/behavior`
- **Sidebar (`AppSidebar.tsx`)**: Add "Behavior Profile" nav item
- **`App.tsx`**: Add `/behavior` route

---

### Files Changed/Created Summary

| Action | File |
|--------|------|
| Migration | New columns on `user_attempts`, new `question_difficulty_tiers` table, new `behavior_profiles` table, new column on `questions` |
| Create | `supabase/functions/analyze-behavior/index.ts` |
| Create | `supabase/functions/compute-question-tiers/index.ts` |
| Create | `src/pages/BehaviorProfile.tsx` |
| Edit | `src/pages/Practice.tsx` — enhanced tracking + sequencing |
| Edit | `src/pages/Assess.tsx` — enhanced tracking + sequencing + interventions |
| Edit | `src/pages/Profile.tsx` — link to behavior dashboard |
| Edit | `src/components/AppSidebar.tsx` — add nav item |
| Edit | `src/App.tsx` — add route |
| Edit | `supabase/config.toml` — register new edge functions |

