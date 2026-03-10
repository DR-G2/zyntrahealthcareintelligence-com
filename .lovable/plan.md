

## Plan: Zyntra AI Core + User Profile Expansion

This is a large feature with 4 major parts: a user-facing AI visualization page, an admin AI control panel tab, profile field expansion (DB + UI), and sidebar navigation updates.

---

### 1. Database Migration: Add Profile Fields

Add new optional columns to the `profiles` table:

```sql
ALTER TABLE public.profiles
  ADD COLUMN country_of_origin text,
  ADD COLUMN country_of_graduation text,
  ADD COLUMN medical_college text,
  ADD COLUMN graduation_year integer,
  ADD COLUMN current_location text,
  ADD COLUMN exam_stage text;
```

No new RLS policies needed — existing policies already allow users to update their own profile.

---

### 2. New Page: `src/pages/ZyntraAICore.tsx` (User View)

A visually rich page accessible at `/companion/ai-core` showing:

- **AI Intelligence Growth Meter** — animated progress bar using Framer Motion showing a "system intelligence" score derived from `ai_training_context.aggregate_data` (total attempts, candidate count, etc.)
- **Learning Nodes Visualization** — four animated pulsing/floating nodes (Clinical Reasoning, Question Difficulty Mapping, Behavioral Analytics, Timing Patterns) using CSS animations and Framer Motion, connected by faint lines in a neural-network style layout
- **Community Learning Indicator** — live counters fetched from `ai_training_context` showing stats like "AI has analyzed X clinical decisions" and "Learning from Y MCQ interactions today"
- **All data sourced from** the existing `ai_training_context` table (read-only, already has an authenticated SELECT policy)

Design: Dark gradient card backgrounds, glowing accent colors, subtle pulse animations. Purely visual and inspirational — no real model internals exposed.

---

### 3. Admin Tab: AI Control Panel in `AdminDashboard.tsx`

Add a 6th tab "AI Core" to the admin dashboard tabs grid:

**New component: `src/components/admin/AIControlTab.tsx`**

Sections:
- **AI System Monitoring** — Card showing: active model name (hardcoded "gemini-2.5-pro"), dataset size (from `ai_training_context.aggregate_data`), interaction count, candidate count, last training timestamp (`ai_training_context.updated_at`), model version (v1.0)
- **AI Training Controls** — "Retrain AI" button (invokes existing `retrain-ai-context` edge function), schedule toggle (store preference in localStorage for now), feature weight sliders for Clinical Accuracy, Answer Stability, Time Efficiency, Confidence Calibration (visual controls, values stored via edge function call)
- **Data Processing Controls** — Buttons: Run Cleanup (existing), Rebuild Feature Dataset (calls `retrain-ai-context`), Recompute Behavioral Metrics (calls `analyze-behavior`), Reset Model Cache
- **Debug Panel** — Collapsible section showing raw `ai_training_context.aggregate_data` JSON, archetype distribution, trap flag counts, category pass rates

---

### 4. Settings Page: Profile Expansion

Update `src/pages/Settings.tsx` to add a new "Background & Demographics" card after the Profile card with fields:
- Country of origin (text input)
- Country of graduation (text input)  
- Medical college name (text input)
- Graduation year (number input)
- Current location (text input)
- AMC exam stage (Select: Preparing / Booked exam / Retaking exam)

All fields save via the existing `handleSaveProfile` function (extend it to include new fields).

---

### 5. Sidebar Navigation Update

In `src/components/AppSidebar.tsx`, add a new item under "Study Companion" group:

```typescript
{ to: '/companion/ai-core', label: 'Zyntra AI Core', icon: Brain }
```

---

### 6. Route Registration

In `src/App.tsx`:
- Lazy import `ZyntraAICore`
- Add protected route: `/companion/ai-core`

---

### Files Changed

| File | Change |
|------|--------|
| Database migration | Add 6 columns to `profiles` |
| `src/pages/ZyntraAICore.tsx` | New user-facing AI visualization page |
| `src/components/admin/AIControlTab.tsx` | New admin AI control panel component |
| `src/pages/AdminDashboard.tsx` | Add 6th "AI Core" tab |
| `src/pages/Settings.tsx` | Add demographics card with new profile fields |
| `src/components/AppSidebar.tsx` | Add AI Core nav item |
| `src/App.tsx` | Add route for `/companion/ai-core` |

