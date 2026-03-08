

## Plan: Fix OSCE Question Bank to Show Clinical Stations

### Problem
The OSCE Question Bank page (`QuestionsOSCE.tsx`) queries `station_attempts` (user's past completions — currently 0 rows) instead of `clinical_stations` (150 actual stations). So the page always shows "No OSCE attempts yet."

### Root Cause
The page was built as a "history viewer" but should be a **browsable station bank** — showing all 150 clinical stations with subject filtering, similar to the MCQ question bank.

### Solution: Rewrite `QuestionsOSCE.tsx`

Query `clinical_stations` instead of `station_attempts`. Display stations as browsable cards with:

- **Subject filter** using the existing subjects from the database (Cardiology, Gastroenterology, Mental Health, etc.)
- **Search** by scenario title
- **Station cards** showing: scenario title, subject badge, and a preview of the scenario data
- **Expandable detail** — clicking a card shows the full scenario (patient persona summary, examination findings count, investigations count)
- **Past attempt indicator** — if the user has attempted a station, show their score badge (join with `station_attempts` by `session_id`)

Also needs an RLS fix: `clinical_stations` currently has `SELECT` policy `auth.uid() = user_id`, meaning users can only see stations they created. Since these are admin-created stations, we need a policy allowing all authenticated users to read them.

### Database Change
Add an RLS policy on `clinical_stations` to allow all authenticated users to SELECT:
```sql
CREATE POLICY "Authenticated users can read all stations"
ON public.clinical_stations FOR SELECT
TO authenticated
USING (true);
```

### Files Changed

| File | Change |
|------|--------|
| `src/pages/QuestionsOSCE.tsx` | Rewrite to query `clinical_stations`, add subject filter, search, and expandable station cards |
| Database migration | Add public read RLS policy on `clinical_stations` |

### Station Data Available (150 stations across 19 subjects)
Mental Health (14), Gastroenterology (10), Gynaecology (10), General Surgery (9), Paediatrics (9), Orthopaedics (9), Rheumatology (9), Infectious Disease (9), Neurology (8), Cardiology (8), Dermatology (8), Public Health (8), ENT (8), Nephrology (8), Obstetrics (8), Emergency Medicine (6), Respiratory (4), Endocrinology (3), Ophthalmology (2)

