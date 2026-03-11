

## Plan: Remove Social Groups, Shared Tests & Make Review Session-Based

### Changes

**1. Remove from sidebar (`src/components/AppSidebar.tsx`)**
- Remove `Social Groups` and `Shared Tests` from the Study Companion nav group (lines 78-79)
- Remove `Mistake Review` and `Question History` from the APPE nav group (lines 56-57)
- Remove unused imports (`Users`, `Share2`, `AlertCircle`, `History`)

**2. Remove routes from `src/App.tsx`**
- Remove `/companion/groups` route (line 97)
- Remove `/companion/shared-tests` route (line 98)
- Remove `/review` route (line 100)
- Remove `/history` route (line 102)
- Remove lazy imports for `SocialGroups`, `SharedTests`, `MistakeReview`, `QuestionHistory`
- Add redirects: `/review` → `/practice`, `/history` → `/practice`, `/companion/groups` → `/dashboard`, `/companion/shared-tests` → `/dashboard`

**3. Remove feature gate flags (`src/hooks/useFeatureGate.ts`)**
- Remove `canAccessSocialGroups`, `canAccessSharedTests`, `canAccessMistakeReview`, `canAccessHistory` from the interface and all tier return values

The page files (`SocialGroups.tsx`, `SharedTests.tsx`, `MistakeReview.tsx`, `QuestionHistory.tsx`) will remain in the codebase but become inaccessible. The existing `ResultsScreen` in Practice.tsx already provides session-based question review with explanations, making standalone review pages redundant.

