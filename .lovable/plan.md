

## Plan: Wire Up Login, Protected Routes, and Password Reset

The project already has `Login.tsx`, `Onboarding.tsx`, `ProtectedRoute.tsx`, and `AuthContext` built — but they're not connected in the router. Here's what needs to happen:

### Current Issues
- `/login` and `/onboarding` routes are missing from `App.tsx`
- No routes are wrapped with `ProtectedRoute`, so all pages are publicly accessible
- No password reset flow exists

### Changes

**1. Update `src/App.tsx`**
- Import `Login`, `Onboarding`, and `ProtectedRoute`
- Add `/login` route (public)
- Add `/onboarding` route (requires session but not onboarding complete)
- Wrap all authenticated routes (`/dashboard`, `/assess`, `/profile`, `/practice`, `/questions`, `/plan`, `/settings`, `/admin/questions`) with `ProtectedRoute`

**2. Create `/reset-password` page (`src/pages/ResetPassword.tsx`)**
- Detects `type=recovery` from URL hash after email link click
- Shows a "set new password" form
- Calls `supabase.auth.updateUser({ password })` to save

**3. Add forgot password link to `src/pages/Login.tsx`**
- Add a "Forgot password?" link below the login form
- Opens a small inline form or navigates to a forgot password view
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`

**4. Add `/reset-password` route to `App.tsx`** (public route)

### File Changes

| File | Action |
|------|--------|
| `src/App.tsx` | Add routes, wrap with ProtectedRoute |
| `src/pages/Login.tsx` | Add forgot password flow |
| `src/pages/ResetPassword.tsx` | Create — new password form |

