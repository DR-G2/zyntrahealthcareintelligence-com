## Plan: SubtopicManager + Auto-Classification of existing and new questions 

### 1. New File: `src/components/admin/SubtopicManager.tsx`

A card component mirroring `SubjectManager` with:

- **Subject selector** (`<Select>`) to pick which subject's subtopics to view/manage
- **Add subtopic**: Input + button row
- **Scrollable list**: Each subtopic row with name, display_order badge, hover-visible Pencil/Trash buttons
- **Inline rename**: Input + Check/X pattern (same as SubjectManager)
- **Delete**: AlertDialog confirmation before deleting
- All CRUD via `supabase.functions.invoke('admin-manage-questions', { body: { action: 'manage_subtopic', ... } })`

### 2. Update: `src/components/admin/QNSTab.tsx`

- Import `SubtopicManager`
- Render it below the `SubjectManager` (after line 136), passing the `subjects` array
- Add a shared `refreshSubjects` callback so both managers trigger the same reload

### 3. Auto-Classification on Import

Update the import flow in `QNSTab.tsx` (`importQuestions` function) to auto-detect and tag `category` and `subtopic` when they are missing from the JSON:

- Before sending each batch, load the subject-subtopic map (fetched once at import start)
- For each question missing `category`:
  - Scan `question_text` against the 6 subject names and all subtopic names (case-insensitive keyword match)
  - If a subtopic name matches, assign both the subtopic and its parent subject
  - If only a subject name matches, assign the subject with subtopic left as-is
  - If no match, fall back to the first subject ("Medicine") and flag in import errors
- For each question missing `subtopic` but having `category`: scan question text against that subject's subtopics
- This runs entirely client-side before the batch is sent, no backend changes needed

### 4. Update: `supabase/functions/import-questions/index.ts`

Make `category` no longer strictly required — if the client sends a classified category, use it; the client-side auto-classifier handles the detection. Change the validation (line 29) to allow missing `category` with a fallback to `"Uncategorized"`.

### Files Changed

- `src/components/admin/SubtopicManager.tsx` (new)
- `src/components/admin/QNSTab.tsx` (add SubtopicManager + auto-classify logic)
- `supabase/functions/import-questions/index.ts` (relax category requirement)

### No database changes needed

The `subtopics` table and `manage_subtopic` edge function actions already exist.