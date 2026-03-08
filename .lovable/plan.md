

## Plan: Mistake Review Engine, Feature Gating, Pricing Restructure & AMC Readiness Score

This is a large scope request with 4 major workstreams. Here's what already exists vs. what needs building:

**Already built:** Bookmarks (toggle in Question Bank), Notes (add/edit per question), Incorrect tab (filter by wrong answers). These are fully functional in `Questions.tsx`.

---

### 1. Mistake Review Engine (New Page)

Create `src/pages/MistakeReview.tsx` — a dedicated review hub with 3 tabs:

- **Incorrect**: Questions answered wrong (from `user_attempts` where `is_correct = false`)
- **Changed Answers**: Questions where `answer_changes_count > 0` (right-to-wrong = "panic changes", wrong-to-right = "good instinct")
- **Guessed**: Questions with `time_to_first_click < 3s` OR `time_taken_seconds < 15s` (quick guesses)

Each question card shows: question text, your answer vs correct, category, change history, and links to full explanation. Add spaced repetition hints ("Review again in 3 days").

Add route `/review` in `App.tsx` and sidebar nav link.

### 2. Feature Gating System

Create `src/hooks/useFeatureGate.ts` — a hook that reads `subscription.tier` from AuthContext and enforces limits:

**Free tier limits:**
- 20 MCQs per day (track in `localStorage` with date key, reset daily)
- 1 OSCE station per day (same tracking)
- Limited question bank access (200 questions visible)
- Basic analytics only (hide Trust Your Gut, Behavior Profile)
- AI companion: 5 prompts/day

**Full Access (core/pro/lifetime):** Everything unlocked, unlimited.

Create `src/components/UpgradePrompt.tsx` — a reusable modal/banner shown when a free user hits a limit. Links to `/pricing`.

Apply gating in: `Practice.tsx` (MCQ limit), `Stations.tsx` (OSCE limit), `CompanionChat.tsx` (prompt limit), `BehaviorProfile.tsx` & `TrustYourGut.tsx` (paywall), `Questions.tsx` (limit visible questions for free users).

### 3. Pricing Restructure

Update `src/lib/stripe-config.ts` to reflect new structure. The user wants:
- **Free**: $0 (lead generator with limits above)
- **Full Access**: $49/month OR $99/3 months

This means consolidating Core ($29) and Pro ($49) into one "Full Access" tier at $49/month. Keep Lifetime ($299) as-is.

Update `src/pages/Pricing.tsx`:
- Simplify to 3 cards: Free, Full Access ($49/mo), Lifetime ($299)
- Add the $99/3-month option as a toggle on the Full Access card
- Update feature lists to match new gating

Update `supabase/functions/check-subscription/index.ts` to map the new product IDs.

**Note:** This requires creating a new Stripe product/price for "Full Access" ($49/mo) and a $99/3-month price. Will use Stripe tools.

### 4. AMC Readiness Score

Create `src/components/ReadinessScore.tsx` — a prominent card on Dashboard showing predicted pass probability.

Calculation (based on existing data):
- `clinical_accuracy` from `performance_profiles` (weight: 40%)
- `stability_score` (weight: 15%)
- Total questions attempted vs benchmark of 2000 (weight: 20%)
- OSCE station scores average (weight: 15%)
- `confidence_gap` inverse (weight: 10%)

Display: Large percentage with color coding (red < 50%, amber 50-70%, green > 70%), trend arrow, and "What to improve" suggestions.

Add to Dashboard and Profile pages. This is a **paid feature** (gated for free users, shown as blurred preview with upgrade CTA).

---

### Files

| File | Action |
|------|--------|
| `src/pages/MistakeReview.tsx` | New — Mistake review engine with 3 tabs |
| `src/hooks/useFeatureGate.ts` | New — Feature gating hook with daily limits |
| `src/components/UpgradePrompt.tsx` | New — Upgrade modal for free users |
| `src/components/ReadinessScore.tsx` | New — AMC Readiness Score card |
| `src/lib/stripe-config.ts` | Update — New pricing tiers |
| `src/pages/Pricing.tsx` | Update — Simplified 3-tier layout |
| `src/pages/Dashboard.tsx` | Update — Add Readiness Score card |
| `src/pages/Practice.tsx` | Update — Add daily MCQ limit for free users |
| `src/pages/Stations.tsx` | Update — Add daily OSCE limit for free users |
| `src/pages/CompanionChat.tsx` | Update — Add daily prompt limit |
| `src/pages/BehaviorProfile.tsx` | Update — Paywall for free users |
| `src/pages/TrustYourGut.tsx` | Update — Paywall for free users |
| `src/pages/Questions.tsx` | Update — Limit visible questions for free |
| `src/App.tsx` | Update — Add `/review` route |
| `src/components/AppSidebar.tsx` | Update — Add "Mistake Review" nav link |
| `supabase/functions/check-subscription/index.ts` | Update — New product ID mapping |

