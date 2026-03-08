

## Plan: Add System/Subject Hierarchical Filters to Questions Page

### Overview
Replace the flat category `Select` dropdown on the Questions page with the same hierarchical System/Subject dual-filter system already built in the Practice page.

### Changes: `src/pages/Questions.tsx` only

**1. Import the same filter data structures**
- Copy `SYSTEMS`, `SUBJECTS`, `SYSTEM_SUBJECTS`, `SUBJECT_SYSTEMS` constants from Practice.tsx (or extract to a shared file)
- Import `Collapsible`, `ToggleGroup`, `Checkbox` components

**2. Replace category dropdown with hierarchical filter panel**
- Add `filterMode: 'system' | 'subject'` state and `selectedPairs: Set<string>` state
- Add a collapsible filter panel (toggled by the existing Filter icon/button) containing:
  - Filter mode toggle (System View / Subject View)
  - Search input to filter systems/subjects
  - Two-column grid of collapsible items with checkboxes (same UI pattern as Practice)
  - Select All / Clear All buttons
  - Question counts per system/subject from loaded data

**3. Update filtering logic**
- Replace the simple `category === category` check in the `filtered` useMemo with logic that matches question categories against selected system:subject pairs using the same `getMatchingCategories` approach from Practice
- Keep the existing search, difficulty, and tab filters unchanged

**4. Keep existing category dropdown as fallback**
- Retain the flat category dropdown as a quick-select option alongside the hierarchical panel, or replace entirely with the new system

### Not Modified
- Question card rendering, expansion, bookmarks, notes, attempt history
- Data loading logic
- Any other pages or components

