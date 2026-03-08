

## Problem

Auto-confirm email signups is enabled, which means:
- No confirmation email is ever sent on signup
- The `auth-email-hook` edge function is never triggered for signup events
- Users can register with emails they don't own

## Fix

**Disable auto-confirm for email signups** using the `cloud--configure_auth` tool. This will:
- Require users to verify their email before they can sign in
- Trigger the `auth-email-hook` function to send branded confirmation emails via `notify.zyntr.website`

### Change

| Action | Detail |
|--------|--------|
| Configure auth | Disable auto-confirm for email signups |

No code changes needed — the templates, edge function, and domain are all already in place. The only missing piece is that auto-confirm is bypassing the entire email verification flow.

After disabling auto-confirm, new signups will receive the branded "Welcome aboard" confirmation email from `noreply@zyntr.website`.

