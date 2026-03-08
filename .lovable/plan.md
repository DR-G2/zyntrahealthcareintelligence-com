

## Plan: Simplify Sidebar to 3 Main Headings

Remove the "Overview" group (Dashboard link). The sidebar will have exactly 3 top-level headings that act as expandable sections opening their respective pages/sub-options:

```text
── Learn & Practice ──────
   MCQ               → /practice
   OSCE              → /stations
   Questions
     ├─ MCQ          → /questions/mcq
     └─ OSCE         → /questions/osce
   Trust Your Gut    → /trust-your-gut

── Analytics ─────────────
   Diagnostic
     ├─ MCQ          → /assess
     └─ OSCE         → /assess/osce
   Performance       → /profile
   Behavior          → /behavior

── Study Plan ────────────
   → /plan (direct link, no sub-items)
```

### Changes

**`src/components/AppSidebar.tsx`**
- Remove the `Overview` group from `navGroups`
- Rename `Planning` group to `Study Plan`
- The "Study Plan" group has a single direct link, so clicking the heading itself navigates to `/plan` (no sub-items needed, or keep it as a single item under the group)

**`src/pages/Dashboard.tsx`** — Optional cleanup
- The `/dashboard` route still works but is no longer in the sidebar. Users land on it after login. Could redirect `/dashboard` to `/practice` or keep it as a welcome/home page. No change needed unless you want to remove it.

### Files

| File | Action |
|------|--------|
| `src/components/AppSidebar.tsx` | Remove Overview group, rename Planning → Study Plan |

