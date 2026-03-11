

## Plan: AMC Readiness DNA Visualization

Build a circular DNA-style competency wheel showing per-subject readiness, with a composite readiness score and drill-down to practice weak areas.

### Architecture

**New file: `src/components/ReadinessDNA.tsx`**
- Main component containing the circular DNA chart and composite score
- Uses Recharts `RadarChart` (or `PolarAngleAxis` + custom radial bar) for the circular visualization
- Fetches `user_attempts` joined with `questions` to compute per-subject stats (accuracy, count, avg time, trend)
- Uses the existing `SYSTEMS` from `src/lib/filter-data.ts` as the subject list (Cardiology, Respiratory, Neurology, etc. -- already matches the AMC subjects requested)
- Gated behind `gate.canAccessReadiness` with blurred upgrade prompt for free users

**Integration into Dashboard:**
- Replace the existing `<ReadinessScore />` on `src/pages/Dashboard.tsx` with the new `<ReadinessDNA />` component
- The composite readiness score (currently in `ReadinessScore.tsx`) will be integrated into the top of the DNA component

### Data Flow

Query `user_attempts` with question category info:
```sql
user_attempts(id, is_correct, time_taken_seconds, created_at, question_id, answer_changes_count,
  questions(category))
```
Group by `questions.category`, then map each category to the nearest SYSTEM from `filter-data.ts`. For each system compute:
- **Accuracy %** = correct / total
- **Questions attempted** = count
- **Avg response time** = avg(time_taken_seconds)
- **Trend** = compare last-30-day accuracy vs prior-30-day accuracy (improving/declining/stable)
- **Readiness score per subject** = weighted blend of accuracy (50%), stability from answer_changes_count (25%), time efficiency (25%)

Composite score uses the existing formula weights: Clinical Accuracy 40%, Answer Stability 20%, Time Management 20%, Confidence Calibration 20% -- pulled from `performance_profiles`.

### Visual Design

1. **Composite Score** at the top -- large circular gauge showing "68/100" style
2. **DNA Wheel** below -- Recharts `RadarChart` with:
   - Each axis = one AMC system (17 systems from SYSTEMS constant)
   - Fill area colored with gradient (green center fading to red outer = inverted, or segments colored individually)
   - Custom tooltip on hover showing: accuracy %, questions attempted, avg response time, trend arrow
3. **Color coding**: Each subject dot/segment colored green (>=70%), yellow (50-69%), red (<50%)
4. **Click interaction**: Clicking a red/yellow segment navigates to `/practice?category=SubjectName` to start a focused drill

### Component Structure

```
<ReadinessDNA>
  ├── CompositeScoreGauge (circular ring with score)
  ├── DNARadarChart (Recharts RadarChart)
  │   └── Custom tooltip with stats
  └── WeakAreaActions (buttons for red segments → link to /practice?category=X)
</ReadinessDNA>
```

### Files to Create/Edit

| File | Action |
|------|--------|
| `src/components/ReadinessDNA.tsx` | Create -- main DNA visualization component |
| `src/pages/Dashboard.tsx` | Edit -- replace `<ReadinessScore />` with `<ReadinessDNA />` |
| `src/components/ReadinessScore.tsx` | Keep (the composite score logic will be reused inside ReadinessDNA) |

### Key Implementation Details

- Use Recharts `RadarChart` with `PolarGrid`, `PolarAngleAxis`, `Radar` -- already installed
- Custom `<Tooltip>` content component for hover stats
- Framer Motion for animated score counter and chart entrance
- Mobile responsive: on small screens, show a simplified bar chart fallback or smaller radar
- Feature-gated: free users see blurred preview with upgrade prompt
- Navigation on weak-area click: `<Link to={/practice?category=${system}}>` to trigger a practice drill filtered to that subject

