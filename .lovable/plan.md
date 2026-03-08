

## Plan: First-Time Welcome Tour (7-8 Steps)

Create a full-screen, animated welcome tour that shows **only once** after a new user completes onboarding and lands on the Dashboard for the first time. Uses `localStorage` to track completion.

### Welcome Tour Steps (8 steps)

1. **Welcome to Zyntra** — Warm greeting with the user's name, app purpose (AMC exam prep platform)
2. **Diagnostic Assessment** — Explains MCQ & OSCE diagnostics to benchmark current level
3. **Practice Drills** — MCQ modes (Recharge/No Change), topic filtering, timed practice
4. **Clinical Stations (OSCE)** — AI patient chat, 3 modes (Single, Adaptive, Exam)
5. **AI Study Companion** — Chat with the AI buddy for explanations, study tips
6. **Study Plan** — Auto-generated adaptive plan based on weak areas and exam date
7. **Social & Shared Tests** — Create study groups, share test codes with friends, leaderboards
8. **You're All Set!** — CTA to start with a diagnostic or jump to practice

### Technical Approach

- **New component**: `src/components/WelcomeTour.tsx`
  - Full-screen modal overlay with step counter, animated transitions (framer-motion)
  - Each step: icon, title, description, optional illustration
  - Back/Next/Skip buttons, progress dots
  - On completion or skip, sets `localStorage.setItem('welcome_tour_complete', 'true')`
- **Integration in `src/pages/Dashboard.tsx`**:
  - Check `localStorage` for `welcome_tour_complete`
  - If not set, render `<WelcomeTour />` overlay on top of the dashboard
  - Tour dismisses and dashboard becomes fully interactive

### Files

| File | Action |
|------|--------|
| `src/components/WelcomeTour.tsx` | New — 8-step animated welcome tour component |
| `src/pages/Dashboard.tsx` | Import and conditionally render WelcomeTour |

