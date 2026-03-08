

## Plan: Hierarchical Practice Drill Configuration

### Overview
Replace the flat topic selector and fixed dropdown in the `SetupScreen` component with a hierarchical dual-filter system (System View / Subject View) and a flexible numeric question count input with quick presets.

### Changes to `src/pages/Practice.tsx` (SetupScreen only)

**1. New Filter Data Structures**

Define static mappings:
- `SYSTEMS`: 16 clinical systems (Cardiology, Respiratory, etc.)
- `SUBJECTS`: 10 academic subjects (Physiology, Pathology, Pharmacology, etc.)
- `SYSTEM_SUBJECTS`: Maps each system → its subjects
- `SUBJECT_SYSTEMS`: Maps each subject → its systems

**2. Filter Mode Toggle**

Add state: `filterMode: 'system' | 'subject'`

Render toggle at top:
```
Filter Mode: [System View] [Subject View]
```

**3. System View UI**

- Collapsible cards for each of the 16 systems
- Inside each expanded system: checkboxes for subjects (Physiology, Pathology, etc.)
- Clicking system header toggles all subjects within it
- Show question counts from actual database categories

**4. Subject View UI**

- Collapsible cards for each of the 10 subjects
- Inside each expanded subject: checkboxes for systems (Cardiology, Respiratory, etc.)
- Clicking subject header toggles all systems within it

**5. Selection Logic**

Track selections as pairs: `Set<"system:subject">` (e.g., "Cardiology:Pharmacology")

When querying questions:
- Map selection pairs back to database categories
- Current `category` column values will need matching logic (e.g., categories containing system + subject keywords)

**6. Question Count Selector**

Replace dropdown with:
```
Questions
[10] [20] [40] [60] [100]  ← Quick presets
[ – ] [ 25 ] [ + ]         ← Stepper input
≈ 25 minutes
```

- Min: 1, soft max: 500
- Numbers only, no decimals
- Dynamic time estimate: `{count} questions ≈ {count} minutes`

**7. Utility Controls**

Add at top of filter panel:
- "Select All" / "Clear All" buttons
- Show question counts per system/subject: "Cardiology (142 questions)"

**8. UI Styling**

- Maintain dark UI, rounded cards, collapsible arrows (ChevronDown)
- Soft blue highlight for active selections
- Two-column grid layout for filter items

### Not Modified

- Mode selection (Recharge/No Change)
- DrillSession component
- ResultsScreen component
- Sidebar navigation
- AppLayout

### Technical Notes

The database `questions.category` column contains mixed values. The filter will need to:
1. Fetch distinct categories on load
2. Map them to system/subject pairs where possible
3. Fall back to showing unmapped categories in an "Other" section

