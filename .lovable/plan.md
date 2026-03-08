

## Plan: Piracy Strike System with Adjustable Watermark

### Overview
Create a strike-based piracy detection system. Admins can issue strikes against users for piracy violations. Each strike automatically increases the user's watermark opacity, making it progressively more visible. At 3 strikes, the account is suspended.

### Database Changes (2 new tables)

**`piracy_strikes` table** — logs each strike event:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `reason` (text) — admin-provided reason
- `issued_by` (uuid, FK → auth.users) — admin who issued it
- `created_at` (timestamptz)

**`watermark_settings` table** — per-user watermark config:
- `id` (uuid, PK)
- `user_id` (uuid, unique, FK → auth.users)
- `opacity_light` (numeric, default 0.055)
- `opacity_dark` (numeric, default 0.065)
- `suspended` (boolean, default false)
- `updated_at` (timestamptz)

**Trigger**: On insert into `piracy_strikes`, auto-update `watermark_settings` — increase opacity by 0.03 per strike. At 3+ strikes, set `suspended = true`.

RLS: Users can read their own watermark settings. Only admins can insert strikes and manage settings.

### Frontend Changes

| File | Change |
|------|--------|
| `src/contexts/AuthContext.tsx` | Fetch user's watermark settings (opacity + suspended) alongside profile |
| `src/components/SecurityOverlay.tsx` | Use dynamic opacity from context instead of hardcoded values; show "Account Suspended" blocker if suspended |
| `src/pages/AdminDashboard.tsx` | Add a "Piracy Strikes" section — search user, view strike count, issue strike with reason, see strike history |
| `src/pages/Settings.tsx` | Show strike count and current watermark level as a warning to the user |

### Strike Escalation Logic

| Strikes | Light Opacity | Dark Opacity | Status |
|---------|--------------|-------------|--------|
| 0 | 0.055 | 0.065 | Normal |
| 1 | 0.085 | 0.095 | Warning |
| 2 | 0.115 | 0.125 | High visibility |
| 3+ | — | — | Suspended |

### Per-Page Watermark (Optional Override)
The `SecurityOverlay` will accept an optional `opacityOverride` prop so specific pages (e.g., questions, OSCE stations) can enforce higher watermark opacity regardless of the user's default level.

