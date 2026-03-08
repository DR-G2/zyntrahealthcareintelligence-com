

## Plan: Fix Diagnostic Difficulty Distribution + Confirm Shared Filter Extraction

### Issue 1: Diagnostic Difficulty Distribution
The Assess page currently fetches 200 random questions with no difficulty control. The database has 3486 hard, 180 medium, and 348 easy questions — so random sampling heavily skews toward hard.

**Fix in `src/pages/Assess.tsx`** (fetchPool function, ~lines 66-96):

Replace the single query with three separate queries that enforce the target distribution for a 20-question diagnostic:
- **Hard (50%)**: 10 questions → fetch ~50 hard questions randomly
- **Medium (30%)**: 6 questions → fetch ~30 medium questions randomly  
- **Easy (20%)**: 4 questions → fetch ~20 easy questions randomly

Combine and shuffle all three pools into `questionPoolRef.current`. The sequencing engine then picks from this pre-balanced pool.

### Issue 2: Shared Filter Constants
Already done — `src/lib/filter-data.ts` exists and both `Practice.tsx` and `Questions.tsx` already import from it. No further extraction needed.

### Files Modified
- `src/pages/Assess.tsx` — difficulty-balanced question fetching

### Not Modified
- Sequencing engine, sidebar, dashboard, practice, questions, or any other pages

