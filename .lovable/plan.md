

## Issue: Signup Confirmation Emails Not Being Sent

Your email domain (`notify.zyntr.website`) is verified and all 6 email templates are scaffolded. The `auth-email-hook` edge function code exists but shows no logs, which means it either isn't deployed or isn't being triggered.

### Fix

**Deploy the auth-email-hook edge function** — this is the function that intercepts auth events (signup, recovery, etc.) and sends your branded emails. It needs to be deployed so the system routes auth events to it.

One step:
- Deploy `auth-email-hook` using the edge function deployment tool

After deployment, signup confirmation emails will be sent from `noreply@zyntr.website` using your branded Zyntra template whenever a new user signs up with email/password.

No code changes are needed — the templates and function code are already complete.

