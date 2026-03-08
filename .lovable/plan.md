

## Plan: Add Search Filter to Topic Filters

### Change: `src/pages/Practice.tsx` (SetupScreen only)

1. **Add `searchQuery` state** (`useState<string>('')`) in the SetupScreen component (around line 89).

2. **Add search input** between the filter mode toggle (line 382) and the system/subject grid (line 384). A simple `Input` with a `Search` icon, placeholder "Search systems or subjects...", with a clear button when text is present.

3. **Filter the displayed lists** based on `searchQuery`:
   - In System View: filter `SYSTEMS` array to only show systems whose name matches OR that contain a matching subject. Auto-expand matching systems.
   - In Subject View: filter `SUBJECTS` array to only show subjects whose name matches OR that contain a matching system. Auto-expand matching subjects.

4. **Auto-expand matching items** when search is active so users see results immediately without clicking.

No other components or pages are modified.

