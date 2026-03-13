

## Problem Analysis

Two distinct issues:

1. **False positives**: `visibilitychange` and `window.blur` both fire on simple tab switches, clicking the address bar, opening system menus, etc. Every one of these logs a "screenshot_attempt" to `system_error_logs` — flooding the admin panel with noise. These are **not** screenshots.

2. **Admin exemption missing**: Admin accounts trigger the same blur/flash/log behavior, polluting logs further.

## Plan

### Changes to `src/components/SecurityOverlay.tsx`

**A. Separate blur from screenshot logging:**
- `handleVisibilityChange` and `handleWindowBlur`: Only blur the UI visually. **Do not** call `logScreenshotAttempt`. These are "focus loss" events, not screenshots.
- Remove the `showWarningToast` on focus return (returning to a tab is not evidence of a screenshot).
- Keep `logScreenshotAttempt` calls only for actual screenshot key combos: `PrintScreen`, `Ctrl+Shift+S`, `Cmd+Shift+3`, `Cmd+Shift+4`.

**B. Add admin detection — skip logging and restrictions for admins:**
- Import the `ADMIN_EMAILS` list (extract to a shared constant file or inline).
- If `user?.email` is in the admin list, skip: screenshot logging, blur overlay, context menu blocking, key blocking, watermark rendering. Render children directly.

**C. Deduplicate blur events:**
- Remove `window.blur`/`window.focus` listeners entirely. `visibilitychange` already handles tab switches. `window.blur` fires for too many innocent interactions (clicking address bar, DevTools, OS notifications).

### File: `src/lib/admin-emails.ts` (new)
- Export `ADMIN_EMAILS` array so it's shared between `SecurityOverlay`, `AppSidebar`, `App.tsx`, and `AdminDashboard`.

### Files touched
| File | Change |
|------|--------|
| `src/lib/admin-emails.ts` | New shared constant |
| `src/components/SecurityOverlay.tsx` | Remove blur→log, admin bypass, remove window blur/focus listeners |
| `src/App.tsx` | Import from shared constant |
| `src/components/AppSidebar.tsx` | Import from shared constant |
| `src/pages/AdminDashboard.tsx` | Import from shared constant |

