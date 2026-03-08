// Razorpay product/plan configuration for Zyntra tiers
export const RAZORPAY_TIERS = {
  mcq_only: {
    plan_id: 'plan_SOsMQofBcfw3BU',
    mode: 'subscription' as const,
    name: 'MCQ Only',
    price: 39,
    currency: 'USD',
    interval: 'month',
  },
  mcq_only_3m: {
    plan_id: 'plan_SOsNlReb9DLlAw',
    mode: 'subscription' as const,
    name: 'MCQ Only (3 months)',
    price: 109,
    currency: 'USD',
    interval: '3 months',
  },
  osce_only: {
    plan_id: 'plan_SOsOO6jO9w1WOH',
    mode: 'subscription' as const,
    name: 'OSCE Only',
    price: 39,
    currency: 'USD',
    interval: 'month',
  },
  osce_only_3m: {
    plan_id: 'plan_SOsOwdvVugEsde',
    mode: 'subscription' as const,
    name: 'OSCE Only (3 months)',
    price: 109,
    currency: 'USD',
    interval: '3 months',
  },
  full_access: {
    plan_id: 'plan_SOsQDhBQkgyFfr',
    mode: 'subscription' as const,
    name: 'Full Access',
    price: 59,
    currency: 'USD',
    interval: 'month',
  },
  full_access_3m: {
    plan_id: 'plan_SOsR9Hjy6UHpNG',
    mode: 'subscription' as const,
    name: 'Full Access (3 months)',
    price: 169,
    currency: 'USD',
    interval: '3 months',
  },
  lifetime: {
    plan_id: '',
    mode: 'payment' as const,
    name: 'Lifetime',
    price: 349,
    currency: 'USD',
    interval: 'once',
  },
} as const;

// Plan ID → tier mapping (for subscription verification)
export const PLAN_TIER_MAP: Record<string, string> = {
  'plan_SOsMQofBcfw3BU': 'mcq_only',
  'plan_SOsNlReb9DLlAw': 'mcq_only',
  'plan_SOsOO6jO9w1WOH': 'osce_only',
  'plan_SOsOwdvVugEsde': 'osce_only',
  'plan_SOsQDhBQkgyFfr': 'full_access',
  'plan_SOsR9Hjy6UHpNG': 'full_access',
};

export type TierKey = keyof typeof RAZORPAY_TIERS;
