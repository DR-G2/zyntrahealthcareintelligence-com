// Stripe product/price configuration for Zyntra tiers
export const STRIPE_TIERS = {
  mcq_only: {
    product_id: 'prod_U6zJQt8jlti5si',
    price_id: 'price_1T8lLHA6FxLDmLBVLa46VOlj',
    mode: 'subscription' as const,
    name: 'MCQ Only',
    price: 39,
    interval: 'month',
  },
  mcq_only_3m: {
    product_id: 'prod_U6zKnCYIVwHDwb',
    price_id: 'price_1T8lLXA6FxLDmLBVXYkDPH5r',
    mode: 'subscription' as const,
    name: 'MCQ Only (3 months)',
    price: 109,
    interval: '3 months',
  },
  osce_only: {
    product_id: 'prod_U6zKZcaEJfbQQ5',
    price_id: 'price_1T8lLYA6FxLDmLBVwIRy06Gm',
    mode: 'subscription' as const,
    name: 'OSCE Only',
    price: 39,
    interval: 'month',
  },
  osce_only_3m: {
    product_id: 'prod_U6zKcaN9wFpuNg',
    price_id: 'price_1T8lLZA6FxLDmLBVRP95yNoO',
    mode: 'subscription' as const,
    name: 'OSCE Only (3 months)',
    price: 109,
    interval: '3 months',
  },
  full_access: {
    product_id: 'prod_U6zKrKxtp16K7W',
    price_id: 'price_1T8lLaA6FxLDmLBVkjoRVG2c',
    mode: 'subscription' as const,
    name: 'Full Access',
    price: 59,
    interval: 'month',
  },
  full_access_3m: {
    product_id: 'prod_U6zKGMBtlFy4Oz',
    price_id: 'price_1T8lLbA6FxLDmLBVS5pU1D9g',
    mode: 'subscription' as const,
    name: 'Full Access (3 months)',
    price: 169,
    interval: '3 months',
  },
  lifetime: {
    product_id: 'prod_U6zK1OPYlEhP7U',
    price_id: 'price_1T8lLcA6FxLDmLBV1dJxfKbO',
    mode: 'payment' as const,
    name: 'Lifetime',
    price: 349,
    interval: 'once',
  },
} as const;

// Product ID → tier mapping
export const PRODUCT_TIER_MAP: Record<string, string> = {
  // MCQ Only
  'prod_U6zJQt8jlti5si': 'mcq_only',
  'prod_U6zKnCYIVwHDwb': 'mcq_only',
  // OSCE Only
  'prod_U6zKZcaEJfbQQ5': 'osce_only',
  'prod_U6zKcaN9wFpuNg': 'osce_only',
  // Full Access
  'prod_U6zKrKxtp16K7W': 'full_access',
  'prod_U6zKGMBtlFy4Oz': 'full_access',
  // Lifetime
  'prod_U6zK1OPYlEhP7U': 'lifetime',
  // Legacy products
  'prod_U6yxXHRvDd4Ez8': 'full_access',
  'prod_U6yy9VWpyT13u1': 'full_access',
  'prod_U6sMkFKlyQoIuh': 'lifetime',
  'prod_U6sKBIdCnUC1WH': 'full_access',
  'prod_U6sKziBbluGb0Q': 'full_access',
};

// All product IDs that grant paid access
export const FULL_ACCESS_PRODUCT_IDS = Object.keys(PRODUCT_TIER_MAP);

export type TierKey = keyof typeof STRIPE_TIERS;
