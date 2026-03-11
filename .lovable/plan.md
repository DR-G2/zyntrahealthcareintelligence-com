

## Plan: Add Screenshot Warnings to Users

### Problem
When users trigger a screenshot via tab switching, OS screenshot tools, or window blur (the most common methods), the system silently logs the attempt but **never warns the user**. Only PrintScreen and Ctrl+Shift+S key combos show a toast. This means most screenshot attempts go unnoticed by the user.

### Changes

**File: `src/components/SecurityOverlay.tsx`**

1. **`handleVisibilityChange`** — When the tab becomes visible again after being hidden, show a toast warning:
   - On `document.hidden`: blur + log (keep existing)
   - On return (`!document.hidden`): unblur + show `toast.warning('Screenshot detected — your identity is watermarked on all content.')`

2. **`handleWindowBlur`** — Add a screenshot log call and show a warning toast when focus returns:
   - `handleWindowFocus`: add `toast.warning(...)` notification so users know the blur was detected

3. **Deduplicate warnings** — Add a simple debounce (e.g. a `lastWarningTime` ref) to prevent rapid-fire toasts when users alt-tab quickly. Only show a warning if the last one was more than 5 seconds ago.

### Technical Detail
- Use a `useRef` for `lastWarningRef` timestamp
- In both `handleVisibilityChange` (on return) and `handleWindowFocus`, check `Date.now() - lastWarningRef.current > 5000` before showing toast
- Log the attempt on blur (existing), show warning on focus return (new)

