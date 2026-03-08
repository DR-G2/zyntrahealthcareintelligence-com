

## Redirect Zyntra Logo to /dashboard When Logged In

The sidebar is only rendered for authenticated users (inside `ProtectedRoute`), so the `useAuth` hook is already available. Since the sidebar only shows when logged in, we can simply change the `NavLink` destination from `/` to `/dashboard`.

### Change

**`src/components/AppSidebar.tsx` (line 32)**
- Change `<NavLink to="/">` to `<NavLink to="/dashboard">`

This is safe because the sidebar only renders inside protected routes, meaning the user is always authenticated when they see it.

