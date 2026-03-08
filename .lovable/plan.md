

## Plan: Study Companion Hub with AI Chat, Study Plan, Social Groups & Shared Tests

### Sidebar Restructure

The sidebar will have **3 headings**: Learn & Practice, Analytics, **Study Companion** (replacing Study Plan). Study Companion will contain:

```text
── Study Companion ───────
   AI Chat            → /companion/chat
   Study Plan         → /plan
   Social Groups      → /companion/groups
   Shared Tests       → /companion/shared-tests
```

### New Features

**1. AI Chat Page (`src/pages/CompanionChat.tsx`)**
- Full-page version of the existing Study Buddy chatbot with the same streaming logic
- Reuses the existing `study-buddy` edge function
- Larger layout with sidebar conversation history, markdown rendering, quick prompts

**2. Social Groups (`src/pages/SocialGroups.tsx`)**
- Create/join study groups
- Add members by their registered email address (lookup against `profiles.email`)
- Group list view showing members, group name, and activity
- Database tables needed:
  - `study_groups` (id, name, created_by, created_at)
  - `study_group_members` (id, group_id, user_id, role [owner/member], joined_at)
- RLS: members can view their own groups, owners can manage membership

**3. Shared Tests (`src/pages/SharedTests.tsx`)**
- Generate a shareable code for a test session (MCQ or OSCE config)
- Friends enter the code to join the same test
- After completion, a leaderboard shows all participants' scores
- Database tables needed:
  - `shared_tests` (id, code, created_by, test_type [mcq/osce], config jsonb, created_at, status)
  - `shared_test_participants` (id, shared_test_id, user_id, score jsonb, completed_at)
- RLS: participants can view tests they belong to, creator manages the test

### Database Changes (Migration)

4 new tables with RLS policies:
- `study_groups`, `study_group_members`, `shared_tests`, `shared_test_participants`

### Files

| File | Action |
|------|--------|
| `src/components/AppSidebar.tsx` | Replace "Study Plan" group with "Study Companion" group containing 4 items |
| `src/pages/CompanionChat.tsx` | New — full-page AI chat (reuses study-buddy edge function) |
| `src/pages/SocialGroups.tsx` | New — create/manage study groups, invite by email |
| `src/pages/SharedTests.tsx` | New — generate/join shared test codes, view leaderboard |
| `src/App.tsx` | Add routes for `/companion/chat`, `/companion/groups`, `/companion/shared-tests` |
| Database migration | Create 4 tables with RLS |

### Implementation Order
1. Database migration (4 tables)
2. Sidebar restructure
3. AI Chat page
4. Social Groups page
5. Shared Tests page
6. Route registration

