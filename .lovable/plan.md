

## Plan: Replace Stripe with Razorpay

This is a significant migration touching 7 files. Razorpay uses a different checkout flow than Stripe — instead of redirecting to a hosted checkout page, Razorpay opens an inline checkout modal via a JS SDK loaded on the client.

### Key Differences: Stripe vs Razorpay

| Aspect | Stripe | Razorpay |
|--------|--------|----------|
| Checkout | Redirect to Stripe-hosted page | Inline modal via JS SDK |
| Subscriptions | Stripe manages recurring billing | Razorpay Subscriptions API |
| One-time | Checkout Session | Razorpay Orders API |
| Customer portal | Stripe Billing Portal | No equivalent — must build or skip |
| Subscription check | Query Stripe API | Query Razorpay Subscriptions API |
| Secret needed | `STRIPE_SECRET_KEY` | `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` |

### Prerequisites

You'll need a Razorpay account with:
- **Key ID** (publishable, goes in frontend)
- **Key Secret** (private, stored as backend secret)
- Plans created in Razorpay dashboard for each tier (subscriptions) and a product for lifetime (one-time order)

I'll need to store two secrets: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

### Changes

#### 1. `src/lib/stripe-config.ts` → `src/lib/razorpay-config.ts`
Replace Stripe product/price IDs with Razorpay plan IDs. Structure:
```ts
export const RAZORPAY_TIERS = {
  mcq_only: { plan_id: 'plan_XXX', mode: 'subscription', name: 'MCQ Only', price: 39, interval: 'month' },
  // ... same tiers, with Razorpay plan_id instead of Stripe price_id
  lifetime: { mode: 'payment', name: 'Lifetime', price: 349 },
};
```
Placeholders for plan IDs until you create them in Razorpay dashboard.

#### 2. New edge function: `supabase/functions/create-razorpay-order/index.ts`
- For **subscriptions**: calls Razorpay Subscriptions API to create a subscription
- For **lifetime**: calls Razorpay Orders API to create an order
- Returns `subscription_id` or `order_id` + `razorpay_key_id` to frontend

#### 3. New edge function: `supabase/functions/verify-razorpay-payment/index.ts`
- Receives `razorpay_payment_id`, `razorpay_order_id`/`razorpay_subscription_id`, `razorpay_signature`
- Verifies signature using HMAC SHA256 with key secret
- On success, upserts payment record to a new `payments` table

#### 4. Replace `supabase/functions/check-subscription/index.ts`
- Instead of querying Stripe, query Razorpay Subscriptions API for active subscriptions by customer email/notes
- Or query the local `payments` table for verified payments
- Keep manual_overrides logic as-is

#### 5. Replace `supabase/functions/create-checkout/index.ts`
- Delete or repurpose as `create-razorpay-order`

#### 6. Replace `supabase/functions/customer-portal/index.ts`
- Razorpay has no equivalent billing portal
- Options: remove it, or build a simple "cancel subscription" flow using Razorpay's cancel subscription API

#### 7. `src/pages/Pricing.tsx`
- Load Razorpay checkout.js SDK (`<script src="https://checkout.razorpay.com/v1/checkout.js">`)
- Replace `handleCheckout` to:
  1. Call `create-razorpay-order` edge function
  2. Open Razorpay inline modal with returned order/subscription ID
  3. On success callback, call `verify-razorpay-payment` edge function
  4. Refresh subscription state

#### 8. Database migration
- Create `payments` table to store verified Razorpay payments locally (for faster subscription checks):
  - `id`, `user_id`, `razorpay_payment_id`, `razorpay_order_id`, `razorpay_subscription_id`, `tier`, `status`, `created_at`
- This avoids hitting Razorpay API on every page load

#### 9. `src/pages/AdminDashboard.tsx`
- Update the "Stripe Status" CSV column header to "Payment Status"

### Files Changed

| File | Action |
|------|--------|
| `src/lib/stripe-config.ts` | Rename → `razorpay-config.ts`, replace IDs with Razorpay plan IDs |
| `supabase/functions/create-checkout/index.ts` | Rewrite for Razorpay Orders/Subscriptions API |
| `supabase/functions/check-subscription/index.ts` | Rewrite to query local `payments` table + Razorpay API |
| `supabase/functions/customer-portal/index.ts` | Rewrite as cancel-subscription endpoint |
| `supabase/functions/verify-razorpay-payment/index.ts` | New — signature verification + payment storage |
| `src/pages/Pricing.tsx` | Replace Stripe redirect with Razorpay inline modal |
| `src/pages/AdminDashboard.tsx` | Minor label updates |
| `supabase/functions/admin-list-users/index.ts` | Replace Stripe subscription lookup with payments table query |
| Database migration | Create `payments` table |
| Secrets | Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` |

### Before I Can Implement

1. You need to create plans in your Razorpay dashboard and provide the plan IDs for each tier
2. I'll need to store two secrets (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) — I'll prompt you for these during implementation

