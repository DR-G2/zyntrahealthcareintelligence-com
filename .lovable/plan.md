

## Plan: Fix 4 Admin Issues

### 1. Fix Sidebar Rendering Loop

**Problem:** The `AppLayout` component's `useEffect` on `[isTablet, isMobile]` can cause a re-render cascade: `useIsMobile` initially returns `false` (from `!!undefined`), then switches to `true` after the effect runs, which triggers the `AppLayout` effect to set `collapsed`, causing another render cycle.

**Fix in `src/components/AppLayout.tsx`:**
- Add a `useRef` to track if initial layout has been set, preventing the `useEffect` from repeatedly toggling `collapsed` state on mount.
- Guard the effect with `if (initialSet.current) return` after first run to prevent re-triggering.

**Fix in `src/hooks/use-mobile.tsx`:**
- Initialize `useIsMobile` state with `window.innerWidth < MOBILE_BREAKPOINT` instead of `undefined` to avoid the initial false→true flip.

### 2. Investigate Admin Users Tab Data Fetching

**Current state:** The `UsersTab` calls `admin-list-users` which fetches profiles, payments, overrides, and presence in separate queries. This works but has no pagination — all users are loaded at once.

**Fix in `supabase/functions/admin-list-users/index.ts`:**
- Add optional `page` and `page_size` parameters to support pagination.
- Add `.order('created_at', { ascending: false })` for consistent ordering.
- Return `total_count` alongside `users` for the frontend.

**Fix in `src/pages/AdminDashboard.tsx` (UsersTab):**
- Add pagination controls (Previous/Next buttons) with page state.
- Pass `page` and `page_size` to the edge function invocation.

### 3. Enable Admin Activity Logging

**Current state:** The `ActivityLogsTab` and `admin-user-actions` with `get_logs` action already exist and work. The `admin_activity_logs` table exists with no RLS (service-role only).

**Fix:** The logging infrastructure is already functional. The improvement is to ensure ALL admin actions across all edge functions (not just `admin-user-actions`) log to `admin_activity_logs`. Currently, `admin-grant-access`, `admin-manage-questions`, `admin-manage-stations`, `admin-cleanup-*` functions do NOT log their actions.

**Changes to edge functions:**
- `admin-grant-access/index.ts` — Add logging for grant/revoke actions
- `admin-manage-questions/index.ts` — Add logging for create/update/delete question actions  
- `admin-manage-stations/index.ts` — Add logging for station management actions
- `admin-cleanup-questions/index.ts` — Add logging for cleanup results
- `admin-cleanup-stations/index.ts` — Add logging for cleanup results

Each function will insert into `admin_activity_logs` with appropriate `action_type` and `details`.

### 4. Monitor AI Service Latency

**Current state:** `system-health-check` already tracks latency for various services. The `system_health_logs` table stores historical data. The `SystemMonitorTab` displays results.

**Enhancement in `src/components/admin/SystemMonitorTab.tsx`:**
- Add a dedicated "AI Latency" section showing latency trends specifically for AI-related checks (study-buddy, generate-questions, ai-feature-builder).
- Extract AI-specific steps from `system_health_logs` and display a mini Recharts line chart of latency over last 24h.

**Enhancement in `supabase/functions/system-health-check/index.ts`:**
- Add an AI-specific health check that pings the Lovable AI gateway with a minimal request and measures response time.

---

### Files Changed Summary

| File | Change |
|------|--------|
| `src/hooks/use-mobile.tsx` | Initialize state with actual value instead of undefined |
| `src/components/AppLayout.tsx` | Guard collapsed effect to prevent re-render loop |
| `supabase/functions/admin-list-users/index.ts` | Add pagination support |
| `src/pages/AdminDashboard.tsx` | Add pagination UI to UsersTab |
| `supabase/functions/admin-grant-access/index.ts` | Add activity logging |
| `supabase/functions/admin-manage-questions/index.ts` | Add activity logging |
| `supabase/functions/admin-manage-stations/index.ts` | Add activity logging |
| `supabase/functions/admin-cleanup-questions/index.ts` | Add activity logging |
| `supabase/functions/admin-cleanup-stations/index.ts` | Add activity logging |
| `supabase/functions/system-health-check/index.ts` | Add AI gateway latency check |
| `src/components/admin/SystemMonitorTab.tsx` | Add AI latency trend display |

