

## Plan: Three Fixes — Remove Study Buddy Popup, Add Topic Selection to Shared Tests, Add Friend Search to Social Groups

### 1. Remove Study Buddy Floating Chat

**File: `src/components/AppLayout.tsx`**
- Remove the `<StudyBuddy>` component and its import from the layout
- The "Ask Study Buddy" button in `QuestionExplanation.tsx` will remain (it's contextual, not a popup) but its callback will be a no-op or removed

### 2. Add Topic/Category Selection to Shared Test Creation

**File: `src/pages/SharedTests.tsx`**
- In the "Create Shared Test" dialog, add a multi-select for categories (fetched from `questions` table via `SELECT DISTINCT category`)
- Store selected categories in `config.categories` when inserting the shared test
- Add a question count selector (10, 20, 30, 50)
- Display the selected topics on each test card so participants know what the test covers

### 3. Add Friend Search by Email to Social Groups

**File: `src/pages/SocialGroups.tsx`**
- Add a "Find Friends" section at the top of the page with an email search input
- When searching, query `profiles` table by email (RLS already allows authenticated users to read profiles by email)
- Show the found user's name/email with an option to invite them directly to any existing group via a dropdown
- This makes friend discovery independent of being inside a specific group's invite dialog

### Files Changed

| File | Change |
|------|--------|
| `src/components/AppLayout.tsx` | Remove `<StudyBuddy>` import and component |
| `src/pages/SharedTests.tsx` | Add category multi-select + question count to create dialog; show topics on test cards |
| `src/pages/SocialGroups.tsx` | Add standalone email search bar to find and invite friends to groups |

No database changes needed — all existing tables and RLS policies support these features.

