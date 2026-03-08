

## Plan: Admin Dashboard with Unified Content Management

### Overview
Replace the current `/admin/questions` page with a full **Admin Dashboard** at `/admin` with tabbed sections: **Users & Subscriptions**, **MCQ Questions**, and **OSCE Stations**. Access is protected by a hardcoded admin email check (since this is a single-admin app).

### Structure

**Route changes in `App.tsx`:**
- `/admin` → new `AdminDashboard` page (replaces `/admin/questions`)
- Remove old `/admin/questions` route

**Sidebar in `AppSidebar.tsx`:**
- Add admin nav item (only visible if user email matches admin email)

### New Page: `src/pages/AdminDashboard.tsx`

Top-level Tabs component with 3 tabs:

**Tab 1: Users & Subscriptions**
- New edge function `admin-list-users` that uses Stripe API to list all customers with their subscription status, tier, and dates
- Displays a table: Email, Tier (badge), Status, Start Date, End Date
- Search/filter by email
- Uses `STRIPE_SECRET_KEY` (already configured) + service role key to list profiles from DB

**Tab 2: MCQ Questions**
- Embeds the existing `AdminQuestions` content (generate + import functionality)
- Adds a **question browser** section: paginated table of all questions from `questions` table
- Each row shows: truncated question text, category, difficulty, created date
- Edit button opens a dialog/sheet with editable fields (question_text, options, correct_answer, explanation, category, difficulty)
- Delete button with confirmation
- Requires new RLS policy or edge function for admin writes to `questions` table

**Tab 3: OSCE Stations**
- Mirrors the MCQ tab structure but for clinical station scenarios
- **Generate**: Select subject → call `generate-station` to create and store a scenario in `clinical_stations`
- **Import**: JSON paste/file upload for bulk scenario import (new edge function `import-stations`)
- **Browse/Edit**: Table of stored scenarios from `clinical_stations` — title, subject, created date
- Edit dialog for scenario_data JSON + title + subject
- Delete with confirmation

### Database Changes

**New edge function: `admin-list-users/index.ts`**
- Uses service role key to query `profiles` table for all users
- Uses Stripe API to batch-check subscription status for each email
- Returns combined user + subscription data

**New edge function: `admin-manage-questions/index.ts`**
- Accepts `action: 'update' | 'delete'` with question data
- Uses service role key to bypass RLS and update/delete from `questions` table
- Validates admin identity via auth token + hardcoded admin email

**New edge function: `admin-manage-stations/index.ts`**
- Same pattern for OSCE stations — update/delete `clinical_stations` table
- Also handles bulk import of station scenarios

**New edge function: `import-stations/index.ts`**
- Accepts array of station scenario objects
- Validates structure, inserts into `clinical_stations` using service role

### Security
- All admin edge functions verify the caller's email against a hardcoded admin email constant
- No client-side admin checks — all mutations go through edge functions that validate server-side

### Files Summary

| File | Action |
|------|--------|
| `src/pages/AdminDashboard.tsx` | Create — tabbed admin page |
| `src/pages/AdminQuestions.tsx` | Delete (merged into AdminDashboard) |
| `supabase/functions/admin-list-users/index.ts` | Create |
| `supabase/functions/admin-manage-questions/index.ts` | Create |
| `supabase/functions/admin-manage-stations/index.ts` | Create |
| `src/App.tsx` | Modify — update admin route |
| `src/components/AppSidebar.tsx` | Modify — add admin link with email gate |

### Not Modified
- Stations page, Practice, Questions, Dashboard, or any student-facing pages

