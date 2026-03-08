

## Plan: Responsive Layout for Mobile, Tablet, and Laptop

Currently the sidebar is always fixed at 64px or 256px wide with no mobile adaptation — on small screens it covers content or overflows.

### Changes

#### 1. `src/components/AppSidebar.tsx`
- **Mobile (< 768px):** Sidebar becomes an off-canvas drawer — hidden by default, slides in from the left when toggled via a hamburger button. An overlay backdrop closes it on tap.
- **Tablet (768–1024px):** Sidebar defaults to collapsed (icon-only, 64px). Can be expanded on demand.
- **Laptop (> 1024px):** Sidebar defaults to expanded (256px), collapsible as today.
- Add a `mobileOpen` state and use `useIsMobile()` hook to detect breakpoint.
- On mobile, render the sidebar as a fixed overlay with backdrop instead of a permanent fixed element.

#### 2. `src/components/AppLayout.tsx`
- Add a mobile header bar with hamburger menu button (visible only on mobile) that toggles the sidebar drawer.
- On mobile, remove the left margin from `<main>` since the sidebar is an overlay.
- On tablet, default `collapsed = true`.
- Pass `mobileOpen` / `setMobileOpen` through `SidebarContext`.

#### 3. `src/hooks/use-mobile.tsx`
- Add a `useIsTablet()` hook (768–1024px) alongside the existing `useIsMobile()`.

#### 4. `src/pages/Landing.tsx`
- Adjust the landing nav and hero section padding/text sizes for mobile (already mostly responsive, minor tweaks).

#### 5. General page content
- Dashboard grid (`grid-cols-2 lg:grid-cols-4`) and admin tabs already use responsive classes. No changes needed to individual pages — the layout wrapper handles the sidebar responsiveness.

### Behavior Summary

| Breakpoint | Sidebar | Main content margin |
|---|---|---|
| Mobile (< 768px) | Hidden, opens as drawer overlay | `ml-0`, full width |
| Tablet (768–1024px) | Collapsed (icon-only) by default | `ml-16` |
| Laptop (> 1024px) | Expanded by default, collapsible | `ml-16` or `ml-64` |

### Files Changed

| File | Change |
|---|---|
| `src/hooks/use-mobile.tsx` | Add `useIsTablet()` |
| `src/components/AppSidebar.tsx` | Mobile drawer mode with backdrop overlay; respond to mobile/tablet breakpoints |
| `src/components/AppLayout.tsx` | Mobile header with hamburger; responsive margin; default collapsed on tablet |

