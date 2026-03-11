

## Plan: Platform-Wide Animation & UX Enhancements

This is a large multi-part task covering 10 areas. I'll implement the most impactful changes while keeping animations performant using Framer Motion and CSS.

---

### Part 1: Diagnostic Test — Trial Users Only

**File: `src/components/AppSidebar.tsx`**
- Wrap the "Diagnostic" collapsible nav item with a condition: only render when `!gate.isPaid` (free/trial tier). Need to pass `useFeatureGate()` into the sidebar or check subscription status.

**File: `src/pages/Assess.tsx`**
- Add a redirect at the top: if user is on a paid plan, redirect to `/practice` with a toast message.
- Add a "results reveal" animation: after submission, show a 2-3 second animated overlay with a pulsing radar icon + "Analyzing your clinical reasoning..." text before revealing results.

---

### Part 2: Performance Intelligence — Merged Section with Tabbed Navigation

**New file: `src/pages/PerformanceIntelligence.tsx`**
- Create a new page that combines Performance (`/profile`), Behavior (`/behavior`), and Trust Your Gut (`/trust-your-gut`) content into three tabs.
- Use Framer Motion `AnimatePresence` with horizontal slide + fade transitions when switching tabs.
- Each tab renders the existing page content as an embedded component (extract the inner content from each page into reusable components).

**File: `src/components/AppSidebar.tsx`**
- Replace the three separate nav items (Performance, Behavior, Trust Your Gut) with a single "Performance Intelligence" link pointing to `/intelligence`.

**File: `src/App.tsx`**
- Add route `/intelligence` for the new merged page.
- Keep old routes (`/profile`, `/behavior`, `/trust-your-gut`) as redirects to `/intelligence?tab=X` for backward compatibility.

---

### Part 3: AMC Readiness Score Count-Up Animation

**File: `src/components/ReadinessDNA.tsx`**
- Replace the static score display with a count-up animation from 0 to the final score using `useEffect` + `requestAnimationFrame` or Framer Motion's `useMotionValue`/`animate`.
- Animate the SVG ring `strokeDasharray` to fill gradually over ~1.5 seconds.

**File: `src/components/ReadinessScore.tsx`**
- Same count-up treatment for the readiness score display.

---

### Part 4: Clinical Intelligence Map (DNA Radar) Animation

**File: `src/components/ReadinessDNA.tsx`**
- Animate chart data from all-zeros to real values using interpolated state with staggered timing (each segment delayed by 50ms).
- Add hover interaction: use Recharts' `onMouseEnter`/`onMouseLeave` on Radar segments to slightly scale hovered segments.
- Color transitions already exist; the gradual fill will come from the data interpolation.

---

### Part 5: MCQ Answer Selection Micro-Interactions

**File: `src/pages/Practice.tsx`**
- Wrap answer option buttons with Framer Motion: on selection, add a brief `scale(1.02)` + glow effect via `boxShadow` animation.
- On correct/incorrect reveal: animate green/red highlight with a subtle pulse (2 cycles, 300ms each).

---

### Part 6: Resume Session Animation

**File: `src/pages/Dashboard.tsx` or `src/pages/Practice.tsx`**
- When `?resume=` param is detected, show a brief overlay: "Restoring your previous session..." with a progress bar that fills over 1.5s before rendering the quiz.

---

### Part 7: OSCE Station Loading Animation

**File: `src/pages/Stations.tsx`**
- Replace the loading phase with a medical-themed animation: heartbeat-style pulse icon + "Preparing clinical scenario..." text with a fade-in/fade-out heartbeat CSS animation.

---

### Part 8: Sidebar Navigation Hover Animations

**File: `src/components/AppSidebar.tsx`**
- Add CSS transitions to nav items: icon scales to `1.15` on hover, text color shifts with `transition-colors duration-200`.
- Collapsible sections use existing Radix animation; enhance with smoother easing.

---

### Part 9: AI Core Dashboard Widget

**File: `src/pages/Dashboard.tsx`**
- Add a small "Zyntra AI Core" card with animated neural network visualization using CSS keyframes (pulsing dots connected by lines).
- Text: "Zyntra AI is learning from your practice patterns."
- Link to `/companion/ai-core` for full view.

---

### Part 10: Performance Guardrails

All animations will:
- Use CSS transforms and opacity only (GPU-accelerated, no layout thrashing)
- Use Framer Motion's `layout` animations where appropriate
- Be wrapped in `prefers-reduced-motion` media query checks
- Never block data fetching or exam timing logic
- Use `will-change` sparingly and only during active animations

---

### Summary of Files

| File | Action |
|------|--------|
| `src/pages/PerformanceIntelligence.tsx` | New merged page with tabbed navigation |
| `src/components/AppSidebar.tsx` | Merge nav items, hide Diagnostic for paid users, add hover animations |
| `src/App.tsx` | Add `/intelligence` route, redirects for old routes |
| `src/components/ReadinessDNA.tsx` | Count-up score, staggered radar animation |
| `src/components/ReadinessScore.tsx` | Count-up score animation |
| `src/pages/Practice.tsx` | MCQ option micro-interactions, resume overlay |
| `src/pages/Stations.tsx` | Heartbeat loading animation |
| `src/pages/Assess.tsx` | Trial-only guard, diagnostic results reveal animation |
| `src/pages/Dashboard.tsx` | AI Core widget, resume session animation |
| `src/hooks/useFeatureGate.ts` | No changes needed (trial detection already works via `isPaid`) |

