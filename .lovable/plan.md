

## Plan: Integrate OSCE + Trust Your Gut Data into Analytics

Currently, Performance and Behavior analytics only pull from `user_attempts` (MCQ data). The user wants these analytics pages to incorporate OSCE station data and Trust Your Gut session data as well, making analytics a unified view across all practice modes.

### Changes

**1. `supabase/functions/analyze-behavior/index.ts`** — Expand data sources
- Currently fetches only `user_attempts` (MCQ). Add fetches for:
  - `station_attempts` (OSCE) — extract scores, time_taken, behavioral_signals, psychograph data
  - `user_attempts` where `session_id` matches Trust Your Gut sessions (these already exist in user_attempts but need to be identified/tagged)
- Merge OSCE metrics into the analysis prompt sent to the AI:
  - OSCE accuracy (avg scores), time management, behavioral signals
  - Subject-level OSCE performance alongside MCQ subject patterns
- Update the AI prompt to produce a unified behavior profile covering MCQ + OSCE + gut-instinct patterns

**2. `src/pages/Profile.tsx`** (Performance page) — Add OSCE stats section
- Fetch `station_attempts` alongside `performance_profiles`
- Add a new "OSCE Performance" card showing:
  - Average station scores, number of stations completed
  - Subject breakdown from OSCE attempts
- Add a "Trust Your Gut" summary card:
  - First-instinct accuracy rate, points lost from changes
- Keep existing MCQ behavioral dimensions as-is, but add a tab or toggle for "MCQ | OSCE | Combined" view

**3. `src/pages/BehaviorProfile.tsx`** — Include OSCE behavioral data
- Fetch `station_attempts` and `psychograph_history` data
- Add OSCE-specific behavioral metrics alongside existing MCQ ones:
  - Communication patterns (from station chat transcripts)
  - Clinical reasoning (from station scores breakdown)
  - Psychograph radar overlay showing OSCE behavioral axes
- Show combined subject radar chart with both MCQ and OSCE data points

**4. `src/pages/Assess.tsx`** — Link diagnostic results to unified analytics
- After MCQ diagnostic completes, mention OSCE diagnostic availability
- Cross-link to `/assess/osce` for complete diagnostic picture

### Files

| File | Action |
|------|--------|
| `supabase/functions/analyze-behavior/index.ts` | Add station_attempts + TYG data to analysis |
| `src/pages/Profile.tsx` | Add OSCE + TYG summary cards, mode toggle |
| `src/pages/BehaviorProfile.tsx` | Add OSCE behavioral signals + psychograph overlay |
| `src/pages/Assess.tsx` | Minor: cross-link to OSCE diagnostic |

No database changes needed — all data already exists in `station_attempts`, `psychograph_history`, and `user_attempts`.

