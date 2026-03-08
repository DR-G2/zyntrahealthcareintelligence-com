// Razorpay product/plan configuration for Zyntra tiers
// Replace plan_id values with your actual Razorpay plan IDs from the dashboard
export const RAZORPAY_TIERS = {
  mcq_only: {
    plan_id: 'plan_PLACEHOLDER_MCQ_MONTHLY',
    mode: 'subscription' as const,
    name: 'MCQ Only',
    price: 39,
    currency: 'USD',
    interval: 'month',
  },
  mcq_only_3m: {
    plan_id: 'plan_PLACEHOLDER_MCQ_3M',
    mode: 'subscription' as const,
    name: 'MCQ Only (3 months)',
    price: 109,
    currency: 'USD',
    interval: '3 months',
  },
  osce_only: {
    plan_id: 'plan_PLACEHOLDER_OSCE_MONTHLY',
    mode: 'subscription' as const,
    name: 'OSCE Only',
    price: 39,
    currency: 'USD',
    interval: 'month',
  },
  osce_only_3m: {
    plan_id: 'plan_PLACEHOLDER_OSCE_3M',
    mode: 'subscription' as const,
    name: 'OSCE Only (3 months)',
    price: 109,
    currency: 'USD',
    interval: '3 months',
  },
  full_access: {
    plan_id: 'plan_PLACEHOLDER_FULL_MONTHLY',
    mode: 'subscription' as const,
    name: 'Full Access',
    price: 59,
    currency: 'USD',
    interval: 'month',
  },
  full_access_3m: {
    plan_id: 'plan_PLACEHOLDER_FULL_3M',
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
  'plan_PLACEHOLDER_MCQ_MONTHLY': 'mcq_only',
  'plan_PLACEHOLDER_MCQ_3M': 'mcq_only',
  'plan_PLACEHOLDER_OSCE_MONTHLY': 'osce_only',
  'plan_PLACEHOLDER_OSCE_3M': 'osce_only',
  'plan_PLACEHOLDER_FULL_MONTHLY': 'full_access',
  'plan_PLACEHOLDER_FULL_3M': 'full_access',
};

export type TierKey = keyof typeof RAZORPAY_TIERS;
