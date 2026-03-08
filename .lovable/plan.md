

## Plan: Unified Cleanup with Detailed Report

### What Changes

**1. Update both edge functions** (`admin-cleanup-questions/index.ts` and `admin-cleanup-stations/index.ts`) to return lists of affected items (not just counts):
- `deleted_items`: array of `{ id, title/question_text, category/subject, reason }` for each deleted item
- `normalized_items`: array of `{ id, title, old_category, new_category }` for each normalized item

**2. Add a "Run Full Cleanup" card** to the Admin Dashboard (top-level, above the tabs or as a new combined section) that:
- Calls both `admin-cleanup-questions` and `admin-cleanup-stations` in parallel
- Shows a unified report dialog after completion with two sections (MCQ / OSCE), each listing:
  - Deleted items with reason (garbage / template / duplicate)
  - Normalized items with old → new category
  - Summary counts and final distribution
- Uses a scrollable Dialog with collapsible sections per cleanup type

**3. Keep individual cleanup buttons** in their respective tabs as-is (for targeted runs).

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/admin-cleanup-questions/index.ts` | Add `deleted_items` and `normalized_items` arrays to response |
| `supabase/functions/admin-cleanup-stations/index.ts` | Add `deleted_items` and `normalized_items` arrays to response |
| `src/pages/AdminDashboard.tsx` | Add "Run Full Cleanup" card at top of dashboard with report dialog; update individual cleanup handlers to also show item-level detail in logs |

### Report Dialog UI
- Large scrollable dialog
- Two tabs or sections: "MCQ Report" and "OSCE Report"
- Each shows: summary stats, table of deleted items (title, category, reason), table of normalized items (title, old → new)
- Export-friendly (all text, copy-pasteable)

