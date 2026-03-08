

## Add Home Navigation to Zyntra Logo in Sidebar

Click the Zyntra logo/name in the top-left corner of the sidebar to navigate to the landing page (`/`).

### Change

**File: `src/components/AppSidebar.tsx`**
- Wrap the logo + "Zyntra" text `div` (lines ~33-39) in a `<Link to="/">` from react-router-dom, replacing the plain `div` container.

