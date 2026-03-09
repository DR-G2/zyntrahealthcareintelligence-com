

## Plan: Fix Last Active & Add IP Address Tracking

### Issue 1: Last Active Not Working

The admin `LiveActivityTab` reads `last_active` from the `user_progress` table, but that field is rarely updated. Meanwhile, the `usePresence` hook updates `user_presence.last_seen_at` every 30 seconds. **Fix**: Use `user_presence.last_seen_at` as the source of truth for "last active" in the admin stats.

### Issue 2: IP Address Tracking

Client-side JavaScript cannot access the user's IP address. We need a backend function that reads the IP from request headers and stores it.

### Changes

#### 1. Database Migration: Add `ip_address` to `user_presence`

```sql
ALTER TABLE public.user_presence ADD COLUMN ip_address text;
```

#### 2. New Edge Function: `track-presence`

- Reads IP from `request.headers.get('x-forwarded-for')` or `'x-real-ip'`
- Accepts `current_page` in the request body
- Upserts `user_presence` with `user_id`, `current_page`, `is_online`, `last_seen_at`, and `ip_address`
- Uses the auth token to identify the user (no service role needed for own-row upsert)

#### 3. Update `usePresence` hook

- Replace direct `supabase.from('user_presence').upsert(...)` with `supabase.functions.invoke('track-presence', { body: { current_page, is_online } })`
- Keep the same heartbeat/visibility logic

#### 4. Update `admin-live-stats` edge function

- Replace `user_progress.last_active` with `user_presence.last_seen_at` for the "last active" field
- Include `ip_address` from `user_presence` in the response

#### 5. Update `LiveActivityTab` component

- Add `ip_address` column to the admin table
- Display IP for each user (useful for piracy cross-referencing — multiple accounts from same IP)

### Files Changed

| File | Change |
|------|--------|
| Database migration | Add `ip_address` column to `user_presence` |
| `supabase/functions/track-presence/index.ts` | New edge function to capture IP |
| `supabase/config.toml` | Register `track-presence` with `verify_jwt = false` |
| `src/hooks/usePresence.ts` | Call edge function instead of direct DB |
| `supabase/functions/admin-live-stats/index.ts` | Use `user_presence.last_seen_at` + include IP |
| `src/components/admin/LiveActivityTab.tsx` | Add IP column to table |

