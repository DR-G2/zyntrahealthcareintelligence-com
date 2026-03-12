

## Plan: Clean Up Dashboard & Polish Feed UI

### 1. Dashboard — Remove Diagnostic & Practice Drills Cards

**File: `src/pages/Dashboard.tsx`**

Remove the entire bottom grid (lines 149-200) containing three cards: "Take Diagnostic", "Practice Drills", and "Feed". These are redundant since all three are accessible from the sidebar. Also remove unused imports (`ClipboardCheck`, `Zap`, `Rss`).

The dashboard will then show: Welcome header → Exam Countdown → Resume Session → Daily Usage (free) → ReadinessDNA → Zyntra AI Core widget. Clean and focused.

### 2. Feed — Streamline & Polish UI

**File: `src/pages/Feed.tsx`**

- Remove the `UpgradePrompt` gate check (lines 55-64) — Feed should be accessible to all users as a content tool
- Remove the "Also used by Zyntra for internal content development" footer text (line 361-363)
- Add a more polished header with a gradient accent or subtle icon treatment
- Clean up the tab content cards — merge the textarea and generate button into a more compact, modern layout with placeholder improvements
- Keep all functional logic (generate, save, answer selection, reveal) intact — only trim UI chrome

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Remove 3 bottom action cards + unused imports |
| `src/pages/Feed.tsx` | Remove upgrade gate, remove footer text, polish layout |

