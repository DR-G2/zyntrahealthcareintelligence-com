

## Plan: Loading Skeletons, Error Boundaries, Tooltips & Visual Feedback

### HIGH PRIORITY

**1. Error Boundary Component** — `src/components/ErrorBoundary.tsx`
- Create a React class component error boundary with a friendly fallback UI (icon, message, "Try Again" button)
- Wrap each route's page component in `App.tsx` with the error boundary so crashes are contained per-page

**2. Loading Skeletons** — `src/components/skeletons/`
- Create reusable skeleton layouts for the data-heavy pages:
  - `PageSkeleton.tsx` — generic page skeleton (header + card grid)
  - Use in: `Practice.tsx`, `Profile.tsx`, `BehaviorProfile.tsx`, `Stations.tsx`, `SocialGroups.tsx`, `SharedTests.tsx`, `CompanionChat.tsx`, `StudyPlan.tsx`
- Replace existing `Loader2` spinners and bare `loading` states with skeleton compositions using the existing `Skeleton` primitive
- Each page gets a skeleton matching its layout (e.g., Profile shows tab bar skeleton + 3 card skeletons, Practice shows filter sidebar skeleton + question cards)

### MEDIUM PRIORITY

**3. Tooltips for Complex Features** — across multiple pages
- Add tooltips to:
  - Practice page: "Recharge" / "No Change" mode buttons explaining what each does
  - Behavior Profile: archetype badge, psychograph radar axes
  - Profile: behavioral dimension labels (stability_score, time_sensitivity, etc.)
  - Stations: mode selection buttons (Instant, Adaptive, Exam)
  - Shared Tests: explain the test code system
- Use existing `Tooltip` / `TooltipTrigger` / `TooltipContent` from `@/components/ui/tooltip`

**4. Onboarding Hints** — `src/components/OnboardingTooltip.tsx`
- A dismissible tooltip/popover component that shows on first visit to key pages
- Store dismissed state in localStorage
- Add to: Practice (first MCQ session), Stations (first OSCE), Companion Chat

### LOW PRIORITY

**5. Action Feedback Enhancements**
- Add subtle animations (framer-motion) on: answer selection, group creation success, test code copy
- Add success/error toast consistency — audit existing toast calls for consistent styling
- Add confetti or celebration animation on completing a full test session

**6. Image Optimization**
- Add `loading="lazy"` to any `<img>` tags
- Use WebP format hints where applicable

### Files

| File | Action |
|------|--------|
| `src/components/ErrorBoundary.tsx` | New — React error boundary with fallback UI |
| `src/App.tsx` | Wrap routes with ErrorBoundary |
| `src/components/skeletons/PageSkeleton.tsx` | New — reusable skeleton layouts |
| `src/pages/Practice.tsx` | Replace Loader2 spinner with skeleton |
| `src/pages/Profile.tsx` | Replace loading state with skeleton |
| `src/pages/BehaviorProfile.tsx` | Replace loading state with skeleton, add tooltips to dimensions |
| `src/pages/Stations.tsx` | Add tooltips to mode buttons |
| `src/pages/SocialGroups.tsx` | Replace loading with skeleton |
| `src/pages/SharedTests.tsx` | Replace loading with skeleton, add tooltip to code field |
| `src/pages/CompanionChat.tsx` | Add skeleton for message loading |
| `src/components/OnboardingTooltip.tsx` | New — dismissible first-visit hints |

