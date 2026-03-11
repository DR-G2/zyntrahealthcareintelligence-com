

## Plan: Remove AI Feature Builder

Remove the entire AI Feature Builder feature since it doesn't actually apply changes.

### Files to delete
- `src/pages/AIFeatureBuilder.tsx`
- `supabase/functions/ai-feature-builder/index.ts`

### Files to edit

| File | Change |
|------|--------|
| `src/App.tsx` | Remove `AIFeatureBuilder` lazy import (line 45) and route (line 101) |
| `src/components/AppSidebar.tsx` | Remove the AI Builder nav link block (lines 313-327) and fix the admin nav active-state logic (line 304) to remove the `ai-builder` exclusion |

### Database
- Drop `ai_patch_logs` and `ai_feature_requests` tables via migration

### Notes
- The `types.ts` file will auto-regenerate after the tables are dropped
- No other features depend on these tables or the edge function

