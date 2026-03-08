

## Plan: Remove Analytics, Build Study Plan, Add Settings

### 1. Remove Analytics

**Files:**
- `src/pages/Analytics.tsx` — delete
- `src/App.tsx` — remove Analytics import and `/analytics` route
- `src/components/AppSidebar.tsx` — remove Analytics nav item, remove `BarChart3` import

### 2. Build Study Plan Page

Replace the placeholder at `/plan` with a real study plan generated from the user's diagnostic performance data.

**File:** `src/pages/StudyPlan.tsx` (new)

**Data sources:**
- `performance_profiles` — readiness score, clinical accuracy, stability, time sensitivity, confidence gap
- `profiles.weak_areas` — categories flagged from practice/diagnostic
- `user_attempts` joined with `questions(category)` — per-category accuracy breakdown

**UI sections:**
1. **Readiness Summary** — card showing overall readiness score and a short status label
2. **Focus Areas** — list weak areas (from `profiles.weak_areas`) with recommended daily question targets per category. Categories with <60% accuracy get "High Priority", 60-80% get "Medium", >80% get "Maintain"
3. **Weekly Schedule** — auto-generated 7-day plan distributing weak topics across days, with suggested question counts (heavier on weak areas). Uses exam date from profile to calculate weeks remaining
4. **Recommended Actions** — contextual tips based on performance dimensions:
   - Low stability → "Practice in No Change mode to build decisiveness"
   - Low time sensitivity → "Do timed drills with strict time limits"
   - High confidence gap → "Focus on categories where you overestimate your accuracy"

**Route:** Replace `PlaceholderPage` at `/plan` with `StudyPlan` component in `App.tsx`.

### 3. Build Settings Page

Replace the placeholder at `/settings` with a real settings page.

**File:** `src/pages/Settings.tsx` (new)

**Sections:**
- **Profile Info** — edit name, exam date (updates `profiles` table)
- **Exam Preferences** — change user type (IMG/local grad), update target exam date
- **Account** — email display (read-only), sign out button, danger zone with "Delete my data" (clears user_attempts, performance_profiles, resets profile)
- **About** — app version, links

**Route:** Replace `PlaceholderPage` at `/settings` with `Settings` component in `App.tsx`.

### File Changes Summary

| File | Action |
|------|--------|
| `src/pages/Analytics.tsx` | Delete |
| `src/pages/StudyPlan.tsx` | Create — study plan from performance data |
| `src/pages/Settings.tsx` | Create — profile editing, preferences, account management |
| `src/App.tsx` | Remove Analytics, add StudyPlan and Settings imports |
| `src/components/AppSidebar.tsx` | Remove Analytics nav item |

No database migrations needed.

