

## Plan: Add OSCE Cleanup Button to Admin Dashboard

### Changes

#### 1. Create `supabase/functions/admin-cleanup-stations/index.ts`
A new edge function mirroring the MCQ cleanup logic but for `clinical_stations`:
- Admin auth check (same pattern as existing functions)
- Delete stations with generic template content (e.g. identical history clues like "symptoms started recently", "patient worried about worsening condition")
- Delete stations where subject doesn't match scenario title (mismatched assignments)
- Deduplicate by `scenario_title` (keep oldest)
- Normalize subjects to match `OSCE_SUBJECTS` list (e.g. "Mental Health" to "Psychiatry", "General Surgery" to "Surgery")
- Return summary: total before/after, deleted count, subject distribution

#### 2. Update `src/pages/AdminDashboard.tsx` — OSCETab
Add a "Clean & Normalize Stations" card (between Generate and Import cards) with:
- `cleaning` state variable
- AlertDialog confirmation (same pattern as MCQ cleanup button)
- Calls `admin-cleanup-stations` edge function
- Logs results to the activity log
- Refreshes station list after completion

### Pattern
Identical to the existing MCQ cleanup button (lines 418-458) — same UI card, AlertDialog, loading state, and log output.

