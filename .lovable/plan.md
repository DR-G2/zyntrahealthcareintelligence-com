

## Plan: AMC Question Bank — Generate 500 Questions, Adaptive Difficulty, CSV Import

### Overview

Three parts: (1) an edge function that uses Lovable AI to generate batches of AMC-format clinical questions and seeds them into the database, (2) adaptive difficulty logic in the diagnostic assessment and practice modes, and (3) a CSV import tool so you can also supply your own questions.

### 1. Expand the `questions` table schema

Add new columns to support the rich AMC explanation format you described:

```sql
ALTER TABLE questions ADD COLUMN IF NOT EXISTS diagnosis_explanation text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS first_line_investigation text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS gold_standard_investigation text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS best_treatment text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS differential_diagnoses jsonb DEFAULT '[]';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS incorrect_answer_explanations jsonb DEFAULT '{}';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS key_takeaways text[];
ALTER TABLE questions ADD COLUMN IF NOT EXISTS clinical_vignette boolean DEFAULT true;
```

The `differential_diagnoses` field stores an array of objects: `{diagnosis, reasoning, investigation, treatment}`. The `incorrect_answer_explanations` field maps each option letter to `{why_wrong, when_correct}`.

### 2. Edge function: `generate-questions`

**File:** `supabase/functions/generate-questions/index.ts`

- Accepts a `category` and `batch_size` (default 10, max 20 per call).
- Calls Lovable AI (`google/gemini-2.5-pro`) with a system prompt encoding your AMC MCQ approach structure.
- Uses **tool calling** to get structured JSON output matching the expanded schema.
- Inserts generated questions directly into the `questions` table using the Supabase service role key.
- Returns the count of inserted questions.

The system prompt will instruct the model to produce long, clinical-vignette-style stems (patient history, examination findings, lab results) with 5 options, following Australian guidelines, and filling all the structured fields (diagnosis explanation, differentials, incorrect answer analysis, key takeaways).

### 3. Edge function: `import-questions`

**File:** `supabase/functions/import-questions/index.ts`

- Accepts a JSON array of questions in a defined format.
- Validates required fields, inserts into the `questions` table.
- Returns success/error counts.
- This lets you paste or upload your own 500 questions.

### 4. Admin page: Question Seeder & Importer

**File:** `src/pages/AdminQuestions.tsx`

- A simple admin UI with two sections:
  - **Generate**: Pick category, difficulty, batch size → calls `generate-questions` edge function. Loop through all 19 categories × 3 difficulties to reach 500+.
  - **Import**: Paste JSON or upload CSV → calls `import-questions` edge function.
- Add route `/admin/questions` in App.tsx.

### 5. Adaptive difficulty in Assess.tsx

Replace the current random fetch with an adaptive algorithm:

- Start with **medium** difficulty questions.
- After each answer, track a running score:
  - Correct → increment score
  - Incorrect → decrement score
- When moving to the next question, fetch the next one from the database based on the current score bracket:
  - Score > 2 → fetch **hard**
  - Score < -2 → fetch **easy**
  - Otherwise → fetch **medium**
- Change from pre-fetching all 20 questions to fetching one at a time (or fetch a pool of each difficulty and pick adaptively).
- Track which question IDs have been used to avoid repeats.

### 6. Update QuestionExplanation component

Update `src/components/practice/QuestionExplanation.tsx` to render the new structured fields:

- **Diagnosis section**: diagnosis explanation, first-line investigation, gold standard, best treatment.
- **Differential diagnoses**: rendered as expandable cards.
- **Incorrect answer analysis**: for each wrong option, show why it's wrong and when it would be correct.
- **Key takeaways**: bullet list of high-yield points.
- Keep the existing textbook reference cards.

### 7. Config updates

**`supabase/config.toml`** — add function entries:
```toml
[functions.generate-questions]
verify_jwt = false

[functions.import-questions]
verify_jwt = false
```

### File changes summary

| File | Action |
|------|--------|
| DB migration | Add 6 columns to `questions` table |
| `supabase/functions/generate-questions/index.ts` | New edge function |
| `supabase/functions/import-questions/index.ts` | New edge function |
| `supabase/config.toml` | Add function entries |
| `src/pages/AdminQuestions.tsx` | New admin page |
| `src/App.tsx` | Add admin route |
| `src/pages/Assess.tsx` | Adaptive difficulty fetch logic |
| `src/components/practice/QuestionExplanation.tsx` | Render new structured explanation fields |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

