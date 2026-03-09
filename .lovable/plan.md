

## Plan: Add Daily Usage Progress Bars to Dashboard

### What

Add a card on the Dashboard (visible only to free-tier users) showing three progress bars for daily MCQ, OSCE, and AI prompt usage with current/max counts.

### Changes

#### `src/pages/Dashboard.tsx`

- Import `useFeatureGate` hook and `Progress` component
- After the Exam Countdown grid and before ReadinessScore, add a new `Card` that renders only when `!gate.isPaid`
- Card contains three rows, each with:
  - Label (e.g., "MCQ Attempts")
  - Count text (e.g., "5 / 20")
  - `<Progress>` bar with value as percentage
- Three rows: MCQ (`mcqUsedToday / mcqDailyLimit`), OSCE (`osceUsedToday / osceDailyLimit`), AI Prompts (`promptsUsedToday / promptDailyLimit`)
- Include a small "Upgrade for unlimited" link to `/pricing` below the bars

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add usage card for free users |

