

## Plan: Add Subject Selection for OSCE Shared Tests

### What Changes

When creating a shared test with type "OSCE", add a subject selection UI (using the clinical systems from `filter-data.ts`) so the OSCE station can be generated for a specific subject, just like MCQ tests allow topic selection.

### Changes

#### `src/pages/SharedTests.tsx`

- Import `SYSTEMS` from `@/lib/filter-data`
- Add a new state `selectedSubject` for OSCE subject pick
- After the test type selector, when `testType === 'osce'`, render a subject selection UI using the same `Badge` toggle pattern as MCQ categories, but sourced from `SYSTEMS` (plus "Ethics & Law")
- Validate that at least one subject is selected before creating an OSCE test
- Include `subjects: [selectedSubject]` (or multiple) in the `config` object saved to the database
- Reset `selectedSubject` when dialog closes
- In the test card display, show selected subjects as badges for OSCE tests (already works via `config.categories` display — just ensure OSCE subjects are stored under a visible key)

### Files Changed

| File | Change |
|------|--------|
| `src/pages/SharedTests.tsx` | Add OSCE subject selection UI, validation, and config storage |

No database or edge function changes needed — `config` is already a jsonb column.

