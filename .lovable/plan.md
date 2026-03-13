

## 5 Phases Overview

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Profile Data Expansion (DB + Onboarding + Settings) | Now |
| **Phase 2** | Subscription Validity Timer (UI component + placement) | Now |
| **Phase 3** | Offline OSCE Preloading (IndexedDB cache + adaptive selection) | Now |
| **Phase 4** | Admin Tracking (exam_target, amc1_score, subscription timer in admin) | Later |
| **Phase 5** | Security Hardening + Performance Tuning (obfuscation, cache limits, auto-replace) | Later |

---

## Phase 1: Profile Data Expansion

**Database migration** — Add 4 columns to `profiles`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN exam_target text,          -- 'amc_mcq' | 'amc_clinical' | 'plab' | 'usmle' | 'other'
  ADD COLUMN amc1_score integer,        -- MCQ score if passed
  ADD COLUMN amc2_booking_status text,  -- 'booked' | 'planning' | 'not_yet'
  ADD COLUMN exam_location text;        -- exam venue
```

**AuthContext** — Add these 4 fields to the `Profile` interface.

**Onboarding** — Add a new step (Step 2, shifting weak areas to Step 3) asking:
- Exam target (dropdown: AMC MCQ, AMC Clinical, PLAB, USMLE, Other)
- Conditional: if AMC Clinical → "Passed AMC MCQ?" → if Yes, score input
- Conditional: AMC Clinical booking status → if Booked, exam date + location

**Settings** — Add matching fields in the profile editing card so users can update these later. Include the same conditional logic.

---

## Phase 2: Subscription Validity Timer

**New component**: `src/components/SubscriptionTimer.tsx`
- Reads `subscription.subscription_end` and `subscription.tier` from `useAuth()`
- If lifetime → show "Lifetime Access" badge
- If `remaining_days > 3` → subtle text: "Plan Active · 23 days remaining"
- If `remaining_days ≤ 3` → amber warning badge with live countdown: "⏳ Expires in 2d 14h" + "Renew" link to `/pricing`
- Uses `useEffect` with a 1-minute interval for countdown updates

**Placement** — Render `<SubscriptionTimer />` in:
- `Dashboard.tsx` — below the welcome header
- `Settings.tsx` — in a subscription status card
- `StudyPlan.tsx` — at the top

Only shown for paid users (free users already see daily usage).

---

## Phase 3: Offline OSCE Preloading

**New utility**: `src/lib/osce-cache.ts`
- Uses IndexedDB (via a small wrapper) to store up to 15 station objects
- Exposes: `getCachedStations()`, `cacheStations(stations[])`, `removeCachedStation(id)`, `getCacheCount()`
- Station payload: `{ station_id, title, scenario_data, candidate_instructions, examiner_instructions, marking_checklist, subject, difficulty }`

**New edge function**: `select-adaptive-stations` (already exists — will extend or use as-is)
- Accepts `{ count, exclude_ids }` 
- Selects stations weighted by user's weak areas, recent mistakes, and readiness DNA scores
- Returns station objects

**New hook**: `src/hooks/useOSCEPreload.ts`
- On mount (login, OSCE page open, MCQ session complete): calls `select-adaptive-stations` in background
- Stores results in IndexedDB via `osce-cache.ts`
- Replaces used stations after each session
- Non-blocking — uses `requestIdleCallback` or `setTimeout(0)`

**Stations.tsx integration**:
- When starting a station (instant/adaptive/exam), check cache first
- If cached stations available and match mode requirements → use them (< 1s load)
- If insufficient → fetch from server, merge with cache
- Show "⚡ X stations ready offline" indicator on the mode-select screen

**Preload triggers** — Call `preloadOSCEStations()` from:
- `AuthContext` after `SIGNED_IN` event
- `Practice.tsx` after MCQ session submission
- `Stations.tsx` on mount

