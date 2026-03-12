

## Plan: Toggle About & Pricing Visibility via Database Setting

### 1. Create `site_settings` table (migration)

```sql
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'false'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for landing page, which is public)
CREATE POLICY "Anyone can read site settings"
  ON public.site_settings FOR SELECT TO anon, authenticated
  USING (true);

-- Insert default setting (off by default)
INSERT INTO public.site_settings (key, value) VALUES ('show_about_pricing', 'false'::jsonb);
```

No public write access — only admins via edge function or service role will toggle.

### 2. Create a hook `usePublicPages` 

Reads from `site_settings` where `key = 'show_about_pricing'`. Returns a boolean. Used by Landing page nav and App.tsx routing.

### 3. Update Landing page (`src/pages/Landing.tsx`)

Conditionally render the About and Pricing nav buttons based on the hook value.

### 4. Update routing (`src/App.tsx`)

Conditionally render `/about` and `/pricing` routes. When disabled, redirect to `/`.

### 5. Add toggle to Admin Dashboard

Add a simple Switch in the admin panel (visible to Super Admin) labeled "Show About & Pricing pages". On toggle, updates the `site_settings` row via service-role edge function or direct update (since admin).

### 6. Edge function `admin-toggle-setting`

Accepts `{ key, value }`, verifies caller is admin, updates `site_settings` using service role.

### Summary

| File | Change |
|------|--------|
| Migration | Create `site_settings` table with RLS |
| `src/hooks/useSiteSettings.ts` | New hook to read setting |
| `src/pages/Landing.tsx` | Conditionally show About/Pricing links |
| `src/App.tsx` | Conditionally render routes |
| `src/pages/AdminDashboard.tsx` | Add toggle switch |
| `supabase/functions/admin-toggle-setting/index.ts` | New edge function |

