

## Plan: Remaining UX Animations + Admin Quality Audit Tool

### What's Already Done
The previous implementation already completed: Performance Intelligence merged tabs, Diagnostic hidden for paid users, ReadinessScore count-up animation, OSCE heartbeat loading, Assess submitting radar animation, AI Core dashboard widget, and ReadinessDNA framer-motion integration.

### What Still Needs to Be Done

---

### Part 1: MCQ Micro-Interactions (Practice.tsx)

**File: `src/pages/Practice.tsx` (lines ~815-840)**

Add Framer Motion `motion.button` wrappers to the answer option buttons in the `QuizScreen` component:

- **On selection**: `scale(1.02)` + `boxShadow` glow animation via `whileTap` and conditional `animate` props
- **On correct/incorrect reveal** (in `ResultsScreen` question review): add a subtle 2-cycle pulse via CSS class when showing green/red highlight — the existing `QuestionExplanation` component handles this, so the pulse would be added there

Changes:
- Wrap each option `<button>` in a `<motion.button>` with `whileTap={{ scale: 0.98 }}` and a conditional `animate` that adds a brief glow when `isSelected` transitions
- Add CSS keyframes for `answer-pulse` in `src/index.css`

---

### Part 2: Resume Session Overlay (Practice.tsx)

**File: `src/pages/Practice.tsx` (lines ~591-634)**

When `resumeSessionId` is detected and session is restored, show a 1.5-second animated overlay before rendering the quiz:

- Add a `restoring` state that starts `true` when resume is detected
- Show overlay with "Restoring your previous session..." text + animated progress bar (0-100% over 1.5s)
- After 1.5s, set `restoring = false` and render the quiz
- Use Framer Motion `AnimatePresence` to fade out the overlay

---

### Part 3: Sidebar Hover Animations (AppSidebar.tsx)

**File: `src/components/AppSidebar.tsx`**

Add CSS transition classes to nav item icons and text:
- Icon: `transition-transform duration-200 group-hover:scale-110` on the icon element
- Text: already has `transition-colors`, just verify it's smooth
- Add `group` class to the parent `NavLink`/`button` elements so hover propagates

This is a lightweight CSS-only change — no Framer Motion needed.

---

### Part 4: Admin Quality Audit Tool

**New edge function: `supabase/functions/admin-audit-quality/index.ts`**

Server-side function that scans ALL MCQs and OSCE stations, flagging items that don't meet AMC standards:

MCQ flags:
- Fewer than 5 options
- Stem shorter than 80 words
- Missing explanation
- Missing correct_answer
- Missing category

OSCE flags:
- Missing scenario_title
- Missing candidate_instructions
- Missing marking_checklist or empty checklist
- Missing examiner_instructions

Returns: `{ mcq: { total, flagged, flags: [...] }, osce: { total, flagged, flags: [...] } }`

Each flag item includes: `{ id, zyntra_id, title (truncated), reasons: string[] }`

Auth: same admin-only pattern as other admin functions.

**File: `src/pages/AdminDashboard.tsx`**

Add an "Audit Quality" card inside the MCQ tab (after the cleanup card, ~line 475):
- Button "Run Quality Audit" that calls the edge function
- Results displayed in a dialog showing:
  - Summary: "X of Y MCQs flagged, Z of W OSCE stations flagged"
  - Scrollable table of flagged items with ID, truncated title, and reason badges
  - Each reason is a colored badge (e.g., "< 5 options" in red, "short stem" in orange)

Add an "Audit" tab or integrate into existing MCQ/OSCE tabs with a collapsible section.

---

### Summary of Files

| File | Action |
|------|--------|
| `src/pages/Practice.tsx` | MCQ option micro-interactions + resume overlay |
| `src/components/AppSidebar.tsx` | Icon hover scale transitions |
| `src/index.css` | Add `answer-pulse` keyframe |
| `supabase/functions/admin-audit-quality/index.ts` | New edge function for quality scanning |
| `src/pages/AdminDashboard.tsx` | Add audit button + results dialog |

