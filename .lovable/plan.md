

## Plan: Save Feed-Generated Questions to Question Bank

### What This Does

Add "Save to Question Bank" buttons on Feed results so generated MCQ questions get inserted into the global `questions` table (appearing in future practice sessions), and generated OSCE stations get saved to `clinical_stations`.

### Approach

Since the `questions` table has no INSERT RLS for regular users (by design — it's a curated bank), we need an edge function that uses the service role key to insert. We'll create a new `save-feed-questions` edge function.

### Changes

#### 1. New Edge Function: `supabase/functions/save-feed-questions/index.ts`
- Accepts `{ type: 'mcq' | 'osce', questions?: MCQQuestion[], station?: OSCEStation }`
- Requires authenticated user (extracts user from auth header)
- For MCQ: maps each question to the `questions` table schema (question_text, options as JSONB, correct_answer, explanation, category, difficulty, key_takeaways, differential_diagnoses) and bulk inserts using service role
- For OSCE: inserts into `clinical_stations` with user_id, scenario_title, subject, scenario_data (the full station object), and a new session_id
- Returns the inserted IDs

#### 2. Update `src/pages/Feed.tsx`
- Add a "Save All to Question Bank" button below the MCQ results header
- Add a "Save Station" button on the OSCE result
- Track `savedMcq` and `savedOsce` boolean state to disable buttons after saving
- On save, call `supabase.functions.invoke('save-feed-questions', ...)` and show a success toast
- For OSCE, the station is already saved to `clinical_stations` with the user's ID so it appears in their stations list

#### 3. Files Changed

| File | Change |
|------|--------|
| `supabase/functions/save-feed-questions/index.ts` | New — inserts generated content into questions/clinical_stations |
| `src/pages/Feed.tsx` | Add save buttons with loading/saved states |

No database migration needed — we're inserting into existing tables (`questions`, `clinical_stations`).

