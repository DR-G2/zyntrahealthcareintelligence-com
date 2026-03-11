

## Plan: Screenshot Toast Warning + Admin Screenshot Attempts Tab

### 1. Toast warning on screenshot attempt

**File: `src/components/SecurityOverlay.tsx`**
- Import `toast` from `sonner`
- After each `logScreenshotAttempt` call (PrintScreen, Ctrl+Shift+S, tab_switch), show a toast: "Screenshot detected — your identity is watermarked on all content."
- Only show toast for keyboard triggers (PrintScreen, Ctrl+Shift+S), not tab switches (too noisy)

### 2. New ScreenshotAttemptsTab component

**File: `src/components/admin/ScreenshotAttemptsTab.tsx`** (new)
- Fetches from `system_error_logs` where `error_type = 'screenshot_attempt'` using an edge function (since table has no RLS, need service role)
- Create new edge function `admin-screenshot-logs` that queries `system_error_logs` filtered by `error_type = 'screenshot_attempt'`, joined with profiles for user email/name
- Displays a table with columns: User Email, Name, Trigger Type, Page, IP Address, Timestamp
- Add a refresh button and loading state
- Paginated (50 per page)

### 3. New edge function

**File: `supabase/functions/admin-screenshot-logs/index.ts`** (new)
- Validates admin role via `admin_roles` table
- Queries `system_error_logs` where `error_type = 'screenshot_attempt'`, ordered by `created_at DESC`
- Joins user_id with profiles to get email/name
- Supports `page` and `page_size` params
- Returns entries with user details

### 4. Wire tab into AdminDashboard

**File: `src/pages/AdminDashboard.tsx`**
- Import `ScreenshotAttemptsTab` and `Camera` icon from lucide
- Add a new tab trigger "Screenshots" (super admin only) — update grid-cols from 8→9
- Add corresponding `TabsContent`

### Files Changed

| File | Change |
|------|--------|
| `src/components/SecurityOverlay.tsx` | Add toast warning on screenshot detection |
| `src/components/admin/ScreenshotAttemptsTab.tsx` | New component showing screenshot attempt logs |
| `supabase/functions/admin-screenshot-logs/index.ts` | New edge function to fetch screenshot logs |
| `src/pages/AdminDashboard.tsx` | Add Screenshots tab for super admin |

