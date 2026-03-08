// Stripe product/price configuration for Zyntra tiers
export const STRIPE_TIERS = {
  full_access: {
    product_id: 'prod_U6yxXHRvDd4Ez8',
    price_id: 'price_1T8kzeA6FxLDmLBVZu4frpE7',
    mode: 'subscription' as const,
    name: 'Full Access',
    price: 49,
    interval: 'month',
  },
  full_access_3m: {
    product_id: 'prod_U6yy9VWpyT13u1',
    price_id: 'price_1T8l09A6FxLDmLBVqoRfUSpZ',
    mode: 'subscription' as const,
    name: 'Full Access (3 months)',
    price: 99,
    interval: '3 months',
  },
  lifetime: {
    product_id: 'prod_U6sMkFKlyQoIuh',
    price_id: 'price_1T8ebdA6FxLDmLBVnJofmEOC',
    mode: 'payment' as const,
    name: 'Lifetime',
    price: 299,
    interval: 'once',
  },
} as const;

// All product IDs that grant full access
export const FULL_ACCESS_PRODUCT_IDS = [
  'prod_U6yxXHRvDd4Ez8',  // Full Access monthly
  'prod_U6yy9VWpyT13u1',  // Full Access 3-month
  'prod_U6sMkFKlyQoIuh',  // Lifetime
  // Legacy
  'prod_U6sKBIdCnUC1WH',  // Old Core
  'prod_U6sKziBbluGb0Q',  // Old Pro
];

export type TierKey = keyof typeof STRIPE_TIERS;
