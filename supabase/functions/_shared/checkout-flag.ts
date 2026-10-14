// Server-side checkout kill switch (pure; also runs under vitest).
// FAIL CLOSED: checkout is ON only when edge env CHECKOUT_ENABLED is exactly "true".
// Missing, empty, "TRUE", "1", "yes", " true" ... => OFF (order/subscription creation rejected).
export function checkoutEnabled(raw: string | null | undefined): boolean {
  return raw === "true";
}
export const CHECKOUT_DISABLED_BODY = { error: "Checkout is not available yet", checkout_disabled: true } as const;
