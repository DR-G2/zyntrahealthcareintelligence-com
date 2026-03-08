

## Plan: Anti-Cheating & IP Protection Layer

### Overview
Add a comprehensive anti-cheating system with watermarking and screenshot/copy prevention across all protected pages (Practice, Assess, Stations).

### New Component: `src/components/SecurityOverlay.tsx`
A wrapper component that applies all protections when rendered:

**1. Dynamic Watermark**
- Renders the user's email and name as a semi-transparent, rotated text pattern covering the entire viewport
- Uses CSS `pointer-events: none` so it doesn't interfere with interactions
- Repeating grid pattern at ~45° angle, low opacity (~0.04) — visible if screenshotted but not distracting during use

**2. Screenshot & Copy Prevention (CSS + JS)**
- CSS: `-webkit-user-select: none; user-select: none` on protected content to prevent text selection
- CSS: `@media print { body { display: none } }` to block print/PDF
- JS: Disable right-click (`contextmenu` event)
- JS: Block keyboard shortcuts: `Ctrl+C`, `Ctrl+P`, `Ctrl+S`, `Ctrl+Shift+I`, `Ctrl+U`, `F12`, `PrintScreen`
- JS: Listen for `visibilitychange` — log/flag when user leaves tab (tab-switching detection)
- JS: Block drag events on images/content

**3. DevTools Detection**
- Detect window resize patterns that suggest devtools opening
- Console.log trap using getter to detect open console

### Integration Points
- Wrap content in `AppLayout` or directly in `Practice.tsx`, `Assess.tsx`, and `Stations.tsx` with `<SecurityOverlay>`
- The component reads `user` and `profile` from `useAuth()` to get email/name for the watermark

### Files Summary

| File | Action |
|------|--------|
| `src/components/SecurityOverlay.tsx` | Create — watermark + all protections |
| `src/components/AppLayout.tsx` | Modify — wrap children with SecurityOverlay |
| `src/index.css` | Modify — add print media query |

### Limitations (honest disclosure)
- Browser-level screenshot (OS tools, phone camera) cannot be prevented by web code
- The watermark serves as a deterrent and forensic trace if content is leaked
- DevTools-savvy users can bypass JS protections, but watermark in DOM makes extraction traceable

