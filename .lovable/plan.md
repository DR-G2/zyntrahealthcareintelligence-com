

## Plan: Admin Manual Access, CSV Export & Pricing Restructure

### 1. Admin Manual Access Override

- **DB migration**: Create `manual_overrides` table (`user_id` unique, `tier` text default 'full_access', `granted_by` text, `granted_at`, `expires_at` nullable). RLS: service role only.
- **Edge function** `admin-grant-access`: Admin-protected (email check). Actions: `grant` (insert override with optional expiry) and `revoke` (delete).
- **Update `check-subscription`**: Before Stripe check, query `manual_overrides` for user. If valid (non-expired) override exists, return `subscribed: true` with that tier immediately.
- **Update `admin-list-users`**: Include override data in response.
- **Update `AdminDashboard.tsx` UsersTab**: Add "Grant Access" / "Revoke" buttons per user row, with a dialog for duration (7d, 30d, permanent). Show "Manual" badge.

### 2. CSV/Excel Download of User Data

- Add a "Download CSV" button in `AdminDashboard.tsx` UsersTab.
- Client-side: convert the `users` array to CSV (email, name, tier, status, joined, override info) and trigger a browser download. No new edge function needed — data is already fetched.

### 3. Pricing Restructure (5 tiers)

New tier structure replaces the current 3-tier model:

| Tier | Monthly | 3-Month | Stripe Products Needed |
|------|---------|---------|----------------------|
| Free | $0 | — | None |
| MCQ Only | $39/m | $109/3m | 2 new prices |
| OSCE Only | $39/m | $109/3m | 2 new prices |
| Full Access (MCQ+OSCE) | $59/m | $169/3m | 2 new prices |
| Lifetime | $349 | — | Update existing price |

**Actions:**
- Create 6 new Stripe products/prices via Stripe tools (MCQ monthly, MCQ 3m, OSCE monthly, OSCE 3m, Full monthly, Full 3m). Update Lifetime price to $349.
- **Update `src/lib/stripe-config.ts`**: Replace current tiers with new 5-tier config including product/price IDs.
- **Update `src/pages/Pricing.tsx`**: 5 cards (Free, MCQ Only, OSCE Only, Full Access, Lifetime). Each paid tier shows monthly + 3-month option. Lifetime shows "First 100 users" badge.
- **Update `supabase/functions/check-subscription/index.ts`**: Map new product IDs to tiers: `mcq_only`, `osce_only`, `full_access`, `lifetime`.
- **Update `src/hooks/useFeatureGate.ts`**: Add tier-specific gating:
  - `mcq_only`: unlimited MCQ, free-tier OSCE limits
  - `osce_only`: unlimited OSCE, free-tier MCQ limits  
  - `full_access` / `lifetime`: everything unlimited
- **Update `src/contexts/AuthContext.tsx`**: Add new tier types.

### Files

| File | Action |
|------|--------|
| DB migration | New `manual_overrides` table |
| `supabase/functions/admin-grant-access/index.ts` | New |
| `supabase/functions/check-subscription/index.ts` | Update — overrides + new product IDs |
| `supabase/functions/admin-list-users/index.ts` | Update — include overrides |
| `src/pages/AdminDashboard.tsx` | Update — grant/revoke UI + CSV download |
| `src/lib/stripe-config.ts` | Update — 5 tiers with 10 price IDs |
| `src/pages/Pricing.tsx` | Update — 5 tier cards |
| `src/hooks/useFeatureGate.ts` | Update — tier-specific MCQ/OSCE gating |
| `src/contexts/AuthContext.tsx` | Update — new tier types |
| `supabase/config.toml` | Update — add admin-grant-access function |

