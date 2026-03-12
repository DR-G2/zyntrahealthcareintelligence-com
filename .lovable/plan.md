

## Plan: Add Maintenance Mode & Registration Toggle to Site Settings

### 1. Database — Insert two new setting rows

Insert into the existing `site_settings` table:
- `maintenance_mode` → `false`
- `registration_open` → `true`

### 2. Refactor `SiteSettingsCard` in `AdminDashboard.tsx`

Replace the single-toggle card with a multi-toggle card that loads all settings at once and displays three switches:

| Label | Key | Default | Description |
|-------|-----|---------|-------------|
| Show About & Pricing | `show_about_pricing` | off | Public page visibility |
| Maintenance Mode | `maintenance_mode` | off | Shows maintenance page to non-admin users |
| Registration Open | `registration_open` | on | Allow new signups |

Each toggle calls the existing `admin-toggle-setting` edge function.

### 3. Add generic `useSiteSetting(key)` hook

Refactor `src/hooks/useSiteSettings.ts` to export a generic hook plus the existing `useShowAboutPricing`. Add `useMaintenanceMode()` and `useRegistrationOpen()` convenience wrappers.

### 4. Maintenance Mode gate in `App.tsx`

When `maintenance_mode` is `true`, render a branded "We'll be back soon" full-screen page for all routes except `/admin` and `/login`. Admin users (matched by `ADMIN_EMAILS` list or admin_roles check) bypass the gate.

### 5. Registration gate in `Login.tsx`

When `registration_open` is `false`, hide the "Sign Up" tab and show a "Registration is currently closed" notice instead.

### Summary

| File | Change |
|------|--------|
| DB insert | Add `maintenance_mode` and `registration_open` rows |
| `src/hooks/useSiteSettings.ts` | Add generic hook + convenience wrappers |
| `src/pages/AdminDashboard.tsx` | Expand SiteSettingsCard to 3 toggles |
| `src/App.tsx` | Add maintenance mode gate |
| `src/pages/Login.tsx` | Conditionally hide signup tab |

