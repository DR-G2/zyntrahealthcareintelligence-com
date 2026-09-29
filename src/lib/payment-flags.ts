// Payment provider feature flags.
//
// PayPal is hidden until the owner has configured PayPal keys/plan ids for the
// create-paypal-order / verify-paypal-payment edge functions. Set
// VITE_PAYPAL_ENABLED=true (build-time env var) to show the PayPal option.
// Any other value, or no value, means Razorpay only.
export const PAYPAL_ENABLED = import.meta.env.VITE_PAYPAL_ENABLED === 'true';
