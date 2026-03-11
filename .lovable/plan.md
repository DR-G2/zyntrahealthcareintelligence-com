- Plan: Strengthen Screenshot Deterrence

### Reality Check

No web app can truly block screenshots — the OS handles screen capture before the browser sees it. The real protection is the **watermark** (user's name/email baked into every screenshot). We can make this stronger.

### Improvements

**1. Screen-capture-visible watermark (increase baseline opacity)**

- Increase default `opacity_light` from `0.055` to `0.08` and `opacity_dark` from `0.065` to `0.09` so the watermark is clearly captured in any screenshot.

**2. Blur content on visibility loss**

- When the user switches tabs or the page loses focus (`visibilitychange` + `blur`), apply a CSS blur overlay on the content. This defeats alt-tab screenshot workflows.
- Remove blur when focus returns.

**3. Flash overlay on PrintScreen detection**

- When PrintScreen key is detected, briefly flash a full-screen opaque overlay (white/black) for ~200ms to corrupt any screenshot that does get through the keyboard shortcut.

**4. Log screenshot attempts**

- On PrintScreen key or `visibilitychange` to hidden, log the attempt to the backend via `track-presence` or a new lightweight endpoint, so admins can see who's trying.
- Keep a log of who took screenshot extensively 

### Files Changed


| File                                 | Change                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `src/components/SecurityOverlay.tsx` | Add blur-on-unfocus, flash overlay on PrintScreen, increase default watermark opacity |
| `src/contexts/AuthContext.tsx`       | Update default watermark opacity constants                                            |


### What This Does NOT Do

- Block phone cameras, external screen recorders, or OS-level capture tools — this is impossible from a browser
- The watermark remains the primary defense: every screenshot contains the user's identity