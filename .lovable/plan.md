

## Plan: Add JSON File Upload to Admin Questions Page

### Change

Update `src/pages/AdminQuestions.tsx` to add a file input (`<input type="file" accept=".json">`) alongside the existing textarea. When a `.json` file is selected, read it with `FileReader`, parse it, and feed it into the same `importQuestions` flow.

### Implementation

**Single file: `src/pages/AdminQuestions.tsx`**

1. Add a hidden file input ref and a "Choose File" button that triggers it.
2. On file select, use `FileReader.readAsText()` to read the file contents, then set it into `jsonInput` state (so the user can also preview/edit before importing).
3. Show the selected filename as a badge next to the button.
4. Keep the existing textarea as an optional manual paste fallback.
5. Add a "clear" button to reset the input.

No backend changes needed — the import edge function already accepts JSON via the existing flow.

