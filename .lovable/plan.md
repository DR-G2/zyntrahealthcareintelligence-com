

## Plan: Collapsible Sidebar with Icon-Only Mini Mode

### Approach
Add a `collapsed` state to the sidebar that toggles between full width (w-64) and icon-only mini mode (w-16). A toggle button at the bottom triggers the transition. All labels, group headers, and collapsible children hide when collapsed; only icons remain with tooltips.

### Changes

**`src/components/AppSidebar.tsx`**
- Add `collapsed` / `setCollapsed` state (default: `false`)
- Export `collapsed` state via React context so `AppLayout` can adjust the main content margin
- Create a new `SidebarContext` with `collapsed` boolean
- Toggle button: `PanelLeftClose` / `PanelLeft` icon at the bottom
- When collapsed:
  - Sidebar width changes from `w-64` to `w-16` with `transition-all duration-300`
  - Logo text "Zyntra" hides, only icon shows
  - Group labels (`Overview`, `Learn & Practice`, etc.) hide
  - Nav item labels hide, only icons remain centered
  - Collapsible nav groups (Questions, Diagnostic) show only parent icon; children hidden
  - Bottom section: Settings/Admin/Sign Out show only icons
  - ThemeToggle stays as icon-only (already is)
  - Add `Tooltip` wrappers on each icon showing the label on hover

**`src/components/AppLayout.tsx`**
- Consume `SidebarContext` to dynamically set `ml-64` or `ml-16` on main content
- Wrap with the sidebar context provider

### Files

| File | Action |
|------|--------|
| `src/components/AppSidebar.tsx` | Add collapse state, conditional classes, tooltip wrapping, toggle button, export context |
| `src/components/AppLayout.tsx` | Use context to adjust main margin dynamically |

No new dependencies needed — tooltips from existing Radix/shadcn, `PanelLeftClose`/`PanelLeft` from lucide-react.

