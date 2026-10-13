// Razorpay configuration — Zyntra sells ONE plan: Full Access (AUD).
//   - A$39/month, or A$99 per 3 months
//   - 7-day free trial on both, cancel anytime
//   - A$1 non-refundable card check at trial signup (Razorpay subscription "addon"/upfront amount)
// Billing-period logic & checkout copy live in src/lib/billing.ts (model pending confirmation).
//
// TODO(owner): fill in the LIVE Razorpay plan IDs. Plans must be created in the Razorpay
// dashboard in AUD (A$39 monthly, A$99 every 3 months). The previous USD plan IDs
// (plan_SOsMQofBcfw3BU, plan_SOsNlReb9DLlAw, plan_SOsQDhBQkgyFfr, plan_SOsR9Hjy6UHpNG)
// are retired and must not be reused. Until set, checkout is disabled for that interval.
// Pre-launch note: nothing in this repository records existing paying subscribers on the old
// plans; this was not verified against the production database.
import { CARD_CHECK_AMOUNT, CURRENCY, TRIAL_DAYS } from './billing';

export const RAZORPAY_TIERS = {
  full_access: {
    plan_id: '', // TODO(owner): live AUD plan ID for A$39/month
    mode: 'subscription' as const,
    name: 'Full Access (monthly)',
    interval: 'monthly' as const,
    price: 39,
    currency: CURRENCY,
    trial_days: TRIAL_DAYS,
    card_check_amount: CARD_CHECK_AMOUNT,
  },
  full_access_3m: {
    plan_id: '', // TODO(owner): live AUD plan ID for A$99 / 3 months
    mode: 'subscription' as const,
    name: 'Full Access (3 months)',
    interval: 'quarterly' as const,
    price: 99,
    currency: CURRENCY,
    trial_days: TRIAL_DAYS,
    card_check_amount: CARD_CHECK_AMOUNT,
  },
} as const;

// Plan ID → tier mapping (for subscription verification). Filled from RAZORPAY_TIERS.
export const PLAN_TIER_MAP: Record<string, string> = Object.fromEntries(
  Object.values(RAZORPAY_TIERS).filter((t) => t.plan_id).map((t) => [t.plan_id, 'full_access']),
);

export type TierKey = keyof typeof RAZORPAY_TIERS;
