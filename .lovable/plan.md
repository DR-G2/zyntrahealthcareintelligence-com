

## Plan: Restrict Free Tier to Diagnostic Only

### What Changes

The free tier currently gives 20 MCQs/day in the question bank and 1 OSCE station in practice. The new requirement: free users can **only** access Diagnostic MCQ (`/assess`) and Diagnostic OSCE (`/assess/osce`), plus view their performance results. No access to MCQ question bank, OSCE question bank, practice drills, or stations.

### Changes

#### 1. `src/hooks/useFeatureGate.ts` — Add new flags, update free tier

Add two new flags to the interface:
- `canAccessQBank: boolean` (MCQ question bank access)
- `canAccessOSCEBank: boolean` (OSCE station bank / practice stations)

Free tier returns:
- `canAccessQBank: false`, `canAccessOSCEBank: false`
- `canUseMCQ: true` (for diagnostic only — daily limit still applies)
- `canUseOSCE: true` (for diagnostic only — daily limit still applies)
- `canAccessAnalytics: true` (basic — so they can see diagnostic performance)

Paid tiers set these to `true` according to their plan (MCQ Only gets `canAccessQBank: true`, OSCE Only gets `canAccessOSCEBank: true`, Full/Lifetime get both).

#### 2. `src/pages/Questions.tsx` — Gate with `canAccessQBank`

Add feature gate check at the top. If `!gate.canAccessQBank`, show `<UpgradePrompt feature="MCQ Question Bank">`.

#### 3. `src/pages/QuestionsOSCE.tsx` — Gate with `canAccessOSCEBank`

Already has a gate on `canAccessHistory`. Change to `canAccessOSCEBank`.

#### 4. `src/pages/Practice.tsx` — Gate with `canAccessQBank`

Practice drills are MCQ-based. If `!gate.canAccessQBank`, show upgrade prompt.

#### 5. `src/pages/Stations.tsx` — Gate with `canAccessOSCEBank`

OSCE practice stations. If `!gate.canAccessOSCEBank`, show upgrade prompt.

#### 6. `src/pages/Pricing.tsx` — Update free tier features list and comparison table

Free tier card features become:
- `Diagnostic MCQ test`
- `Diagnostic OSCE station`
- `Basic performance results`
- `AI study companion (limited)`

Comparison table: update MCQ Questions free column to "Diagnostic only", OSCE Stations free column to "Diagnostic only", Question Bank free column to X (no access).

#### 7. `src/pages/Dashboard.tsx` — Update quick links for free users

No changes needed — dashboard links to `/assess` which remains accessible.

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useFeatureGate.ts` | Add `canAccessQBank`, `canAccessOSCEBank` flags |
| `src/pages/Questions.tsx` | Add upgrade gate |
| `src/pages/QuestionsOSCE.tsx` | Switch gate to `canAccessOSCEBank` |
| `src/pages/Practice.tsx` | Add upgrade gate |
| `src/pages/Stations.tsx` | Add upgrade gate |
| `src/pages/Pricing.tsx` | Update free tier features and comparison table |

