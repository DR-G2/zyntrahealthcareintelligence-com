// Razorpay configuration — Zyntra sells ONE plan: Full Access (AUD).
//   - A$39/month, or A$99 per 3 months; 7-day free trial on both; A$1 card check at trial signup.
// The client never holds plan IDs. It sends only { interval } and the create-razorpay-order edge
// function maps it to the live AUD plan IDs from env:
//   RAZORPAY_PLAN_FULL_MONTHLY_AUD  (A$39 / month)
//   RAZORPAY_PLAN_FULL_3M_AUD       (A$99 / 3 months)
// TODO(owner): create both plans in the Razorpay dashboard (AUD) and set those env vars.
// Old USD plan IDs (plan_SOsMQofBcfw3BU, plan_SOsNlReb9DLlAw, plan_SOsQDhBQkgyFfr, plan_SOsR9Hjy6UHpNG) are retired.
// SAFE DEFAULT: checkout is OFF ("Coming soon") unless the build sets VITE_CHECKOUT_ENABLED=true.
// Pre-launch note: nothing in this repository records existing paying subscribers on the old plans;
// this was not verified against the production database.
import { CARD_CHECK_AMOUNT, CURRENCY, TRIAL_DAYS } from './billing';

export const CHECKOUT_ENABLED = import.meta.env.VITE_CHECKOUT_ENABLED === 'true';
export const CHECKOUT_DISABLED = !CHECKOUT_ENABLED;

export const RAZORPAY_TIERS = {
  full_access: {
    mode: 'subscription' as const,
    name: 'Full Access (monthly)',
    interval: 'monthly' as const,
    price: 39,
    currency: CURRENCY,
    trial_days: TRIAL_DAYS,
    card_check_amount: CARD_CHECK_AMOUNT,
  },
  full_access_3m: {
    mode: 'subscription' as const,
    name: 'Full Access (3 months)',
    interval: 'quarterly' as const,
    price: 99,
    currency: CURRENCY,
    trial_days: TRIAL_DAYS,
    card_check_amount: CARD_CHECK_AMOUNT,
  },
} as const;

export type TierKey = keyof typeof RAZORPAY_TIERS;
