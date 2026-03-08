

## Plan: Implement Server-Side Usage Tracking & Complete Feature Gating

### Current State

The project already has:
- `useFeatureGate` hook with plan-wise permissions (client-side, localStorage usage counters)
- Pricing page with all 5 tiers and Razorpay checkout
- `check-subscription` edge function
- `UpgradePrompt` component
- Feature gating on 9 pages (Practice, Stations, Feed, CompanionChat, BehaviorProfile, TrustYourGut, MistakeReview, Questions, QuestionsOSCE)

### What's Missing

1. **Usage tracking is localStorage-only** — resets on device change, not enforceable server-side
2. **4 pages have NO feature gating**: `SocialGroups`, `SharedTests`, `DiagnosticOSCE`, `StudyPlan`
3. **Plan restrictions are too permissive**: MCQ Only gives free-tier OSCE access (spec says NO OSCE). OSCE Only gives free-tier MCQ access (spec says NO MCQ).
4. **No lifetime purchase counter** for "First 100 Users" badge

### Changes

#### 1. Database Migration: Create `user_usage_logs` table

```sql
CREATE TABLE public.user_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  mcq_attempts integer NOT NULL DEFAULT 0,
  osce_attempts integer NOT NULL DEFAULT 0,
  ai_prompts_used integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.user_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can read/upsert their own usage
CREATE POLICY "Users can read own usage"
  ON public.user_usage_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON public.user_usage_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON public.user_usage_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
```

#### 2. Update `useFeatureGate` hook

- Replace localStorage counters with queries to `user_usage_logs` table
- Make the hook async-aware (fetch usage on mount, expose loading state)
- Add `incrementMCQ()`, `incrementOSCE()`, `incrementPrompt()` that upsert server-side
- **Fix plan restrictions**:
  - MCQ Only: `canUseOSCE = false` (not free-tier), `osceDailyLimit = 0`
  - OSCE Only: `canUseMCQ = false` (not free-tier), `mcqDailyLimit = 0`
- Add `canAccessMistakeReview`, `canAccessSocialGroups`, `canAccessSharedTests`, `canAccessStudyPlan` flags

#### 3. Add feature gating to 4 ungated pages

| Page | Gate condition |
|------|---------------|
| `SocialGroups.tsx` | `gate.canAccessSocialGroups` (Full Access / Lifetime only) |
| `SharedTests.tsx` | `gate.canAccessSharedTests` (Full Access / Lifetime only) |
| `DiagnosticOSCE.tsx` | `gate.canAccessExamMode` (OSCE Only / Full Access / Lifetime) |
| `StudyPlan.tsx` | `gate.canAccessStudyPlan` (paid plans only) |

Each will show `<UpgradePrompt>` when access is denied.

#### 4. Update `UpgradePrompt` component

- Change hardcoded "$49/month" to "$39/month" (cheapest paid tier)
- Make the suggested plan dynamic based on what feature is locked (e.g., OSCE features suggest OSCE Only plan)

#### 5. Lifetime purchase counter (display-only)

- Add a simple query in the Pricing page: count rows in `payments` where `tier = 'lifetime'` and `status = 'active'`
- If count >= 100, disable the Lifetime purchase button and change badge to "Sold Out"

### Files Changed

| File | Action |
|------|--------|
| Database migration | New `user_usage_logs` table |
| `src/hooks/useFeatureGate.ts` | Server-side usage, fix plan restrictions, add missing flags |
| `src/pages/SocialGroups.tsx` | Add feature gate |
| `src/pages/SharedTests.tsx` | Add feature gate |
| `src/pages/DiagnosticOSCE.tsx` | Add feature gate |
| `src/pages/StudyPlan.tsx` | Add feature gate |
| `src/components/UpgradePrompt.tsx` | Fix pricing text |
| `src/pages/Pricing.tsx` | Add lifetime counter query |

### Not Changing

- Razorpay webhook already handles subscription expiry → downgrade
- `check-subscription` already handles tier detection
- Pricing page layout and plan cards already match the spec
- Pass Guarantee badge already displayed on Full Access

