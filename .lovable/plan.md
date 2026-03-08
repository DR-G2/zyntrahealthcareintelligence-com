

## Plan: Categorized Sidebar + Diagnostic OSCE + Referral System

This is a multi-part change covering sidebar reorganization, new routes/pages, diagnostic OSCE mode, and a referral system.

---

### Part 1: Sidebar Reorganization (`AppSidebar.tsx`)

Restructure from flat list into collapsible groups with category labels:

```text
── Overview ──────────────
   Dashboard

── Learn & Practice ──────
   MCQ               → /practice
   OSCE              → /stations
   Questions
     ├─ MCQ          → /questions/mcq
     └─ OSCE         → /questions/osce
   Trust Your Gut    → /trust-your-gut

── Analytics ─────────────
   Diagnostic
     ├─ MCQ          → /assess
     └─ OSCE         → /assess/osce
   Performance       → /profile
   Behavior          → /behavior

── Planning ──────────────
   Study Plan        → /plan

── (bottom pinned) ──────
   Settings
   Admin (if admin)
   Theme / Sign Out
```

- Use Collapsible components for "Questions" and "Diagnostic" sub-items
- Small uppercase group labels (`text-[10px] uppercase tracking-wider`)
- `overflow-y-auto` on nav for smaller screens
- Rename: Practice → MCQ, Stations → OSCE in sidebar labels

### Part 2: New Routes + Pages

**Questions subdivisions** — two new routes:
- `/questions/mcq` — shows existing Questions page filtered to MCQ content only
- `/questions/osce` — shows a new OSCE question bank page (station-based questions, case summaries from past station attempts)

**Diagnostic OSCE** — new route:
- `/assess/osce` — a diagnostic assessment that launches a single hard OSCE station
- Reuses existing station generation infrastructure (`generate-station` edge function)
- Selects difficulty based on user's previous `station_attempts` data: picks a subject where user scored lowest, or random hard station if no data
- After evaluation, stores results tagged as `mode: 'diagnostic-osce'` in `station_attempts`

**App.tsx** — add 3 new routes:
- `/questions/mcq`, `/questions/osce`, `/assess/osce`

### Part 3: Referral System

**Database** — new `referrals` table:
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| referrer_id | uuid | FK to auth.users |
| referral_code | text | unique, auto-generated |
| referred_email | text | nullable, filled when used |
| referred_id | uuid | nullable, filled when referred user signs up |
| status | text | 'pending', 'completed' |
| created_at | timestamptz | |

RLS: users can read/insert their own referrals.

**Backend** — new edge function `process-referral/index.ts`:
- On signup with a referral code, validates the code
- Marks referral as completed
- Grants both referrer and referee 7 days of free "core" tier access by creating a Stripe coupon/trial or storing a `free_trial_end` date in profiles

**Frontend** — add a "Refer a Friend" card to Settings page:
- Shows user's unique referral code (generated on first visit)
- Copy-to-clipboard button + share link
- Shows referral status/count

### Part 4: Planning Section Additions

Add to the Study Plan page:
- **Exam Countdown Widget** — prominent days-remaining counter using profile.exam_date
- **Weekly Progress Summary** — compact chart showing questions answered + stations completed this week
- **Resource Links** — curated external AMC study resources

### Files Summary

| File | Action |
|------|--------|
| `src/components/AppSidebar.tsx` | Rewrite — grouped nav with collapsibles |
| `src/App.tsx` | Add 3 new routes |
| `src/pages/QuestionsMCQ.tsx` | Create — MCQ question bank (reuse Questions logic) |
| `src/pages/QuestionsOSCE.tsx` | Create — OSCE question bank from station data |
| `src/pages/DiagnosticOSCE.tsx` | Create — single hard station diagnostic |
| `src/pages/Settings.tsx` | Modify — add referral card |
| `src/pages/StudyPlan.tsx` | Modify — add countdown + weekly summary |
| `supabase/functions/process-referral/index.ts` | Create — referral processing |
| DB migration | Create `referrals` table + add `referral_code` and `free_trial_end` columns to profiles |

