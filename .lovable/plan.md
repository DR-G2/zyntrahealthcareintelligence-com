

## Problem

Screenshot logging is broken for **all users** (not just admins). Two root causes:

1. **Browser limitation**: `e.key === 'PrintScreen'` and `Cmd+Shift+3/4` are intercepted by the OS before reaching the browser. These keyboard events simply never fire in most browsers/OS combinations. The `handleKeyDown` listener catches nothing.

2. **No server-side admin guard**: The edge function `track-presence` has no admin check — if a screenshot event somehow did fire for an admin, it would still be logged server-side.

## Plan

### A. Fix screenshot detection in `SecurityOverlay.tsx`

Replace unreliable keyboard-only detection with multiple detection methods:

- **`visibilitychange` rapid toggle**: If the tab loses and regains visibility within ~300ms, it's likely a screenshot tool (Snipping Tool, macOS screenshot) that briefly steals focus. Log as `screenshot_rapid_focus`.
- **`Ctrl+Shift+S`**: Keep this — it works reliably on Windows/Linux.
- **`PrintScreen`**: Keep but mark