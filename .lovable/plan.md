

## Plan: Update Diagnostic Timing

Change `TOTAL_TIME_SECONDS` in `src/pages/Assess.tsx` from `45 * 60` (45 minutes) to `20 * 60` (20 minutes) to match the AMC ratio of 1 minute per question × 20 questions. `QUESTION_COUNT` is already 20 — no other changes needed.

### File: `src/pages/Assess.tsx`
- Line 22: Change `const TOTAL_TIME_SECONDS = 45 * 60;` → `const TOTAL_TIME_SECONDS = 20 * 60;`
- Update the intro screen text that references "45 minutes" to say "20 minutes"

