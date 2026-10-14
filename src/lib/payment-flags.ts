// Payment provider feature flags.
//
// PayPal is hidden until the owner has configured PayPal keys/plan ids for the
// create-paypal-order / verify-paypal-payment edge functions. Set
// VITE_PAYPAL_ENABLED=true (build-time env var) to show the PayPal option.
// Any other value, or no value, means Razorpay only.
// HARD-DISABLED: the PayPal server catalogue is not yet rewritten for the single AUD plan.
// Re-enable (restore the env check) only after supabase/functions/_shared/paypal.ts is updated.
export const PAYPAL_ENABLED: boolean = false;
