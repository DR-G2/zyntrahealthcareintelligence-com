

## Plan: MCQ/OSCE Quality Standardization + Hide Questions Section + Unique IDs

This is a large multi-part task. Here is what will be done:

---

### Part 1: Hide Questions Section from Navigation

**Files to edit:**
- `src/components/AppSidebar.tsx` -- Remove the "Questions" collapsible nav group (lines 42-48) from the `navGroups` array. MCQ and OSCE browsing will only be accessible through Practice, Diagnostic, Drills, and Admin.
- `src/App.tsx` -- Keep the `/questions`, `/questions/mcq`, `/questions/osce` routes but wrap them with admin-only guards so only admin emails can access them. Regular users hitting these routes will be redirected to `/practice`.

---

### Part 2: Add Unique Question ID Column (`zyntra_id`)

**Database migration:**
```sql
ALTER TABLE public.questions ADD COLUMN zyntra_id text UNIQUE;
ALTER TABLE public.clinical_stations ADD COLUMN zyntra_id text UNIQUE;
```

Then backfill existing rows with sequential IDs:
```sql
-- MCQ IDs
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.questions WHERE zyntra_id IS NULL
)
UPDATE public.questions SET zyntra_id = 'ZYNTRA-MCQ-' || LPAD(numbered.rn::text, 5, '0')
FROM numbered WHERE questions.id = numbered.id;

-- OSCE IDs  
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.clinical_stations WHERE zyntra_id IS NULL
)
UPDATE public.clinical_stations SET zyntra_id = 'ZYNTRA-OSCE-' || LPAD(numbered.rn::text, 5, '0')
FROM numbered WHERE clinical_stations.id = numbered.id;
```

**Auto-assign on insert** -- Add a database trigger so new questions/stations automatically get the next sequential `zyntra_id`.

---

### Part 3: Upgrade `generate-questions` Edge Function for AMC Standards

**File: `supabase/functions/generate-questions/index.ts`**

Enhance the AI system prompt with stricter AMC quality requirements:
- Enforce minimum 120-word clinical vignette stems with patient demographics, presenting complaint, history, examination, and investigations
- Require exactly 5 clinically plausible options (A-E) with no obvious distractors
- Require `subject`, `subtopic`, and `system` tags in the tool schema
- Add guideline references (eTG, RACGP) as a required field
- Normalize difficulty values to `easy`, `moderate`, `difficult`
- Add a validation step post-generation that rejects questions with fewer than 5 options or short stems (<80 words)
- Include the `zyntra_id` auto-assignment (handled by DB trigger)

**Key prompt additions:**
- "Each vignette MUST be at least 120 words with: demographics, presenting complaint, relevant PMHx/medications, examination findings, and at least one investigation result"
- "All 5 distractors must be clinically plausible differential diagnoses or management options -- no obviously wrong answers"
- "Reference Australian Therapeutic Guidelines (eTG) or RACGP guidelines where applicable"
- "Classify difficulty as easy/moderate/difficult based on reasoning steps required"

**New tool schema fields:**
- `subtopic` (string, required) -- e.g. "Acute Coronary Syndrome"
- `system` (string, required) -- e.g. "Cardiovascular"
- `guideline_reference` (string) -- e.g. "eTG - Acute Coronary Syndromes"

---

### Part 4: Add `subtopic`, `system`, `guideline_reference` Columns to Questions Table

**Database migration:**
```sql
ALTER TABLE public.questions ADD COLUMN subtopic text;
ALTER TABLE public.questions ADD COLUMN system text;
ALTER TABLE public.questions ADD COLUMN guideline_reference text;
```

Update the `generate-questions` edge function to populate these on insert.

---

### Part 5: Normalize Difficulty Values

**Database migration** to standardize existing data:
```sql
UPDATE public.questions SET difficulty = 'moderate' WHERE difficulty = 'medium';
```

Update all frontend code that references `'medium'` to use `'moderate'` instead (Practice config, filter dropdowns, etc.).

---

### Part 6: OSCE Station Schema Enhancement

**Database migration:**
```sql
ALTER TABLE public.clinical_stations ADD COLUMN candidate_instructions text;
ALTER TABLE public.clinical_stations ADD COLUMN examiner_instructions text;
ALTER TABLE public.clinical_stations ADD COLUMN marking_checklist jsonb DEFAULT '[]';
ALTER TABLE public.clinical_stations ADD COLUMN reading_time_minutes integer DEFAULT 2;
ALTER TABLE public.clinical_stations ADD COLUMN station_time_minutes integer DEFAULT 8;
```

Update the `generate-station` edge function prompt to require these structured fields in generated stations.

---

### Part 7: Update `generate-station` Edge Function for AMC Clinical Exam Format

**File: `supabase/functions/generate-station/index.ts`**

Enhance prompts to require:
- Candidate instructions (what the candidate reads before entering)
- Examiner instructions (what the examiner observes/prompts)
- Simulated patient script with emotional cues
- Structured marking checklist with scored items
- Reading time (2 min) and station time (8 min) metadata

---

### Summary of Files

| File | Action |
|------|--------|
| `src/components/AppSidebar.tsx` | Remove Questions nav group |
| `src/App.tsx` | Add admin-only guard to `/questions/*` routes |
| `supabase/functions/generate-questions/index.ts` | Upgrade prompt + schema for AMC standards |
| `supabase/functions/generate-station/index.ts` | Upgrade prompt for OSCE standards |
| Database migration | Add `zyntra_id`, `subtopic`, `system`, `guideline_reference` columns; normalize difficulty; add OSCE fields; add auto-ID triggers |

### Technical Notes

- The `zyntra_id` is a display ID only -- the UUID `id` column remains the primary key for all joins and references
- The auto-ID trigger uses `MAX` on existing `zyntra_id` to determine the next sequential number
- Existing questions keep their UUIDs; `zyntra_id` is additive
- The Questions pages remain in code but are inaccessible to non-admin users
- All quality improvements apply to newly generated questions; existing questions retain their current content (admin can regenerate via the admin dashboard)

