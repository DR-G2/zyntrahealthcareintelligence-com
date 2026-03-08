// Stripe product/price configuration for Zyntra tiers
export const STRIPE_TIERS = {
  core: {
    product_id: 'prod_U6sKBIdCnUC1WH',
    price_id: 'price_1T8eZlA6FxLDmLBVDAuIil9G',
    mode: 'subscription' as const,
    name: 'Core',
    price: 29,
  },
  pro: {
    product_id: 'prod_U6sKziBbluGb0Q',
    price_id: 'price_1T8ea9A6FxLDmLBVIdOgqSYP',
    mode: 'subscription' as const,
    name: 'Pro',
    price: 49,
  },
  lifetime: {
    product_id: 'prod_U6sMkFKlyQoIuh',
    price_id: 'price_1T8ebdA6FxLDmLBVnJofmEOC',
    mode: 'payment' as const,
    name: 'Lifetime',
    price: 299,
  },
} as const;

export type TierKey = keyof typeof STRIPE_TIERS;
