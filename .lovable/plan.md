

## Plan: Admin Role System and User Management

### Architecture Decision

Currently, all edge functions check `email === "gopalrock.naren@gmail.com"` for admin access. This plan introduces a proper role system using an `admin_roles` table with three hardcoded entries, a new `admin-user-actions` edge function for ban/unban/delete/reset-password, an `admin_activity_logs` table for audit trails, and UI updates across the admin dashboard.

---

### 1. Database Migration

**New table: `admin_roles`**
```sql
CREATE TABLE public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
-- No RLS policies needed — only service role accesses this table

INSERT INTO public.admin_roles (email, role) VALUES
  ('gopalrock.naren@gmail.com', 'super_admin'),
  ('amc.osce.2026@gmail.com', 'admin'),
  ('testuser123@zyntr.website', 'admin');
```

**New table: `admin_activity_logs`**
```sql
CREATE TABLE public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  action_type text NOT NULL,
  target_user_id uuid,
  target_user_email text,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
```

**Add `is_banned` column to profiles:**
```sql
ALTER TABLE public.profiles ADD COLUMN is_banned boolean NOT NULL DEFAULT false;
```

---

### 2. New Edge Function: `admin-user-actions`

**File:** `supabase/functions/admin-user-actions/index.ts`

Actions: `ban`, `unban`, `reset_password`, `delete_user`, `grant_subscription`, `revoke_subscription`

Auth logic:
- Look up caller's email in `admin_roles` table
- If not found → 403
- For `delete_user`: require `super_admin` role
- For all actions: block if target is super_admin email
- Log every action to `admin_activity_logs`

Ban/unban: Updates `profiles.is_banned`. Ban also calls `supabase.auth.admin.updateUserById(userId, { banned: true })` via the Auth Admin API to invalidate sessions.

Reset password: Calls `supabase.auth.admin.generateLink({ type: 'recovery', email })`.

Delete user: Calls `supabase.auth.admin.deleteUser(userId)` (super_admin only, blocked for super_admin target).

---

### 3. Update All Existing Edge Functions: Multi-Admin Auth

Update the auth check pattern in all admin edge functions to check against `admin_roles` table instead of hardcoded email:

**Files affected:** `admin-list-users`, `admin-grant-access`, `admin-manage-questions`, `admin-manage-stations`, `admin-manage-strikes`, `admin-inspect-user`, `admin-cleanup-questions`, `admin-cleanup-stations`, `admin-reset-test-user`, `admin-live-stats`, `system-health-check`, `retrain-ai-context`

New pattern:
```typescript
const { data: adminRole } = await supabase
  .from("admin_roles")
  .select("role")
  .eq("email", callerEmail)
  .maybeSingle();
if (!adminRole) return 403;
```

For functions that need super_admin only (cleanup, system health, AI retrain): check `adminRole.role === 'super_admin'`.

---

### 4. Frontend: Admin Access Check Update

**File: `src/pages/AdminDashboard.tsx`**

Currently checks `ADMIN_EMAIL` constant. Change to check against a list or query `admin_roles` via a new lightweight edge function call (or simply hardcode the 3 emails client-side for the route guard, since the real security is server-side).

Update the constant:
```typescript
const ADMIN_EMAILS = [
  "gopalrock.naren@gmail.com",
  "amc.osce.2026@gmail.com",
  "testuser123@zyntr.website",
];
const SUPER_ADMIN_EMAIL = "gopalrock.naren@gmail.com";
```

Conditionally hide/show tabs and features based on role:
- Non-super-admins: hide "Run Full Cleanup", "System" tab, "AI Core" tab
- Non-super-admins in Users tab: hide "Delete User" button

---

### 5. Admin Online Panel

**File: `src/pages/AdminDashboard.tsx`**

Add a card at the top of the dashboard showing online admins:
- Query `user_presence` for admin emails where `last_seen_at` > 5 minutes ago
- Show green dot + email + role badge

---

### 6. Users Tab Enhancements

**File: `src/pages/AdminDashboard.tsx` (UsersTab)**

- Add columns: Account Status (Active/Banned), Last Login (from `user_presence`), User ID
- Search also by user ID
- Update `admin-list-users` to return `is_banned` and `last_seen_at` from `user_presence`

**UserInspectionPanel additions:**
- Add action buttons: Ban, Unban, Reset Password, Delete (super_admin only)
- All actions call `admin-user-actions` edge function
- Show confirmation dialogs for destructive actions

---

### 7. Admin Activity Logs Tab

**New component: `src/components/admin/ActivityLogsTab.tsx`**

A new tab "Logs" in the admin dashboard (super_admin only).

- Fetches from `admin_activity_logs` via `admin-live-stats` (extend it) or a new query in `admin-user-actions`
- Table: Admin Email, Action, Target User, Timestamp, IP
- Filters: admin email, action type, date range

---

### 8. Auth Context: Ban Check

**File: `src/contexts/AuthContext.tsx`**

After fetching profile, check `profile.is_banned`. If banned, sign out and show error toast.

---

### Files Changed Summary

| File | Change |
|------|--------|
| Database migration | `admin_roles`, `admin_activity_logs` tables, `is_banned` column |
| `supabase/functions/admin-user-actions/index.ts` | **New** — ban/unban/delete/reset |
| `supabase/functions/admin-list-users/index.ts` | Multi-admin auth, return ban status + presence |
| `supabase/functions/admin-grant-access/index.ts` | Multi-admin auth |
| `supabase/functions/admin-inspect-user/index.ts` | Multi-admin auth |
| `supabase/functions/admin-manage-questions/index.ts` | Multi-admin auth |
| `supabase/functions/admin-manage-stations/index.ts` | Multi-admin auth |
| `supabase/functions/admin-manage-strikes/index.ts` | Multi-admin auth |
| ~6 more edge functions | Multi-admin auth pattern update |
| `src/pages/AdminDashboard.tsx` | Multi-admin UI, online panel, role-based visibility, logs tab |
| `src/components/admin/UserInspectionPanel.tsx` | Action buttons |
| `src/components/admin/ActivityLogsTab.tsx` | **New** — audit log viewer |
| `src/contexts/AuthContext.tsx` | Ban check on profile load |
| `supabase/config.toml` | Register `admin-user-actions` |

