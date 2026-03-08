

## Plan: Add Razorpay Webhook Handler

Create a new edge function `razorpay-webhook` that receives webhook events from Razorpay and updates the local `payments` table accordingly. This removes the need to poll Razorpay's API on every subscription check.

### How Razorpay Webhooks Work

Razorpay sends POST requests with a JSON body and an `X-Razorpay-Signature` header (HMAC SHA-256 of the body using your webhook secret). You need to configure the webhook URL in the Razorpay dashboard.

### New Secret Required

A **`RAZORPAY_WEBHOOK_SECRET`** is needed. This is separate from `RAZORPAY_KEY_SECRET` — it's generated when you create a webhook endpoint in Razorpay Dashboard → Settings → Webhooks.

### Changes

#### 1. New edge function: `supabase/functions/razorpay-webhook/index.ts`
- **Public endpoint** (no JWT auth — Razorpay sends webhooks server-to-server)
- Verifies `X-Razorpay-Signature` header using HMAC SHA-256 with the webhook secret
- Handles these events:
  - `subscription.activated` — upsert payment as `active`
  - `subscription.charged` — update payment `status` to `active`, refresh period
  - `subscription.completed` / `subscription.cancelled` / `subscription.expired` — update payment `status` to `cancelled`
  - `subscription.halted` / `subscription.pending` — update payment `status` to `paused`
  - `payment.captured` — for one-time (order-based) payments, upsert as `active`
  - `payment.failed` — log, optionally mark related payment
- Extracts `user_id` from subscription/payment `notes` field (set during creation)
- Returns 200 OK to acknowledge receipt

#### 2. Update `supabase/config.toml`
- Add `[functions.razorpay-webhook]` with `verify_jwt = false` (public webhook endpoint)

#### 3. Add secret: `RAZORPAY_WEBHOOK_SECRET`
- Prompt user to add this secret (obtained from Razorpay Dashboard → Webhooks)

### Webhook URL to Configure in Razorpay

After deployment, the webhook URL will be:
```
https://yudkfmgilucyhukfggij.supabase.co/functions/v1/razorpay-webhook
```

The user will need to add this URL in Razorpay Dashboard → Settings → Webhooks, selecting the relevant subscription and payment events.

### Files Changed

| File | Action |
|------|--------|
| `supabase/functions/razorpay-webhook/index.ts` | New — webhook handler |
| `supabase/config.toml` | Add webhook function config |
| Secret: `RAZORPAY_WEBHOOK_SECRET` | New — webhook signature verification |

