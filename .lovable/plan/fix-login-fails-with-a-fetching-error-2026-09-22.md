# Fix: login fails with a fetching error

## What is happening

Sign-in is not broken in the app's code. Every request the app makes to its backend — for both admin and normal accounts — is failing before it reaches anywhere, with a plain "failed to fetch". I confirmed this directly:

- The login service answers.
- The data service does not answer at all — the request hangs until it times out.
- The status report claims everything is fine, which does not match what the requests actually do.

So the sign-in screen shows a fetching error because the backend's data side is unreachable, even though it reports itself as healthy. Login also reads settings and the user's profile, so it fails at that point too.

## What I will do

1. Restart the backend (this needs your approval, and briefly interrupts the app).
2. Wait for it to report ready again.
3. Re-test the login service and the data service from here, and confirm both answer.
4. Sign in through the app in a real browser session to confirm a normal account and an admin account both get through, including the profile and settings reads that follow.
5. If it still fails after the restart, report exactly what is still unreachable — this would be an infrastructure problem outside the app, not something to patch around in the app's code.

## What I will not do

No changes to the login page, the sign-in logic, or the backend connection settings. Nothing in the code is at fault here, and editing it would only hide the real cause.

## Small unrelated cleanup (optional)

The browser log also shows a harmless React warning coming from the login form: a component is given a ref it cannot accept. It does not affect sign-in. I can fix it in the same pass if you want.

## Technical notes

- `supabase--cloud_status` returns auth and database reachable (~65ms), but a direct `curl` to `/rest/v1/site_settings` times out (exit 28), while `/auth/v1/health` returns 401 (reachable).
- Preview telemetry: `TypeError: Failed to fetch` at `signInWithPassword` (`AuthContext.tsx:221`), plus failed `GET /rest/v1/site_settings` and `POST /rest/v1/visitor_sessions`.
- Earlier in this session the schema fetch failed with `SUPABASE_POOLER_UNAVAILABLE`, consistent with a pooler/PostgREST-side fault.
- Remediation path per the healthy-status-but-unreachable case: `supabase--restart` (requires user approval), then poll `supabase--cloud_status` until `ACTIVE_HEALTHY`, then re-verify with `curl` and a Playwright login run.
