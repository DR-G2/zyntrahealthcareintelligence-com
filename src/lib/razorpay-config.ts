// Razorpay product/plan configuration for Zyntra tiers
export const RAZORPAY_TIERS = {
  mcq_only: {
    plan_id: 'plan_SOsMQofBcfw3BU',
    mode: 'subscription' as const,
    name: 'Clinical Starter',
    price: 39,
    currency: 'USD',
    interval: 'month',
  },
  mcq_only_3m: {
    plan_id: 'plan_SOsNlReb9DLlAw',
    mode: 'subscription' as const,
    name: 'Clinical Starter (3 months)',
    price: 100,
    currency: 'USD',
    interval: '3 months',
  },
  // Internal key 'full_access' kept for backend/Razorpay compatibility; displayed as "Exam Master".
  full_access: {
    plan_id: 'plan_SOsQDhBQkgyFfr',
    mode: 'subscription' as const,
    name: 'Exam Master',
    price: 59,
    currency: 'USD',
    interval: 'month',
  },
  full_access_3m: {
    plan_id: 'plan_SOsR9Hjy6UHpNG',
    mode: 'subscription' as const,
    name: 'Exam Master (6 months)',
    price: 159,
    currency: 'USD',
    interval: '6 months',
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
  'plan_SOsQDhBQkgyFfr': 'full_access',
  'plan_SOsR9Hjy6UHpNG': 'full_access',
};

export type TierKey = keyof typeof RAZORPAY_TIERS;
