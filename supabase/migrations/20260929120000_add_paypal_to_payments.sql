-- PayPal support for payments (additive, backward compatible; existing Razorpay rows unaffected)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;

-- Idempotency: each PayPal order / subscription can activate a plan only once
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_paypal_order_id
  ON public.payments(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_paypal_subscription_id
  ON public.payments(paypal_subscription_id) WHERE paypal_subscription_id IS NOT NULL;
