

## Plan: Rename tab_switch trigger to "screenshot"

**File: `src/components/SecurityOverlay.tsx`**

Change the `logScreenshotAttempt('tab_switch')` call in `handleVisibilityChange` to `logScreenshotAttempt('screenshot')` so the log entries show "screenshot" instead of "tab_switch" in the admin dashboard.

Also update `src/components/admin/ScreenshotAttemptsTab.tsx` `triggerColor` function to handle the new `'screenshot'` trigger with a appropriate badge color.

| File | Change |
|------|--------|
| `src/components/SecurityOverlay.tsx` | Change `'tab_switch'` → `'screenshot'` in `handleVisibilityChange` |
| `src/components/admin/ScreenshotAttemptsTab.tsx` | Add `'screenshot'` case to `triggerColor` |

