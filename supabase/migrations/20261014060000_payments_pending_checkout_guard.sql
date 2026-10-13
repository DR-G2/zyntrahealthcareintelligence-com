-- Checkout race guard + refund flagging + plan interval. NOT applied live by this PR.
-- Requires 20261014040000, 20261014045000 (dedupe) and 20261014050000.

alter table public.payments
  add column if not exists plan_interval text check (plan_interval in ('monthly', 'quarterly')),
  add column if not exists needs_refund boolean not null default false,
  add column if not exists refund_payment_id text,
  add column if not exists last_razorpay_payment_id text;

-- Expire abandoned checkouts before creating the index (otherwise it could fail on legacy data).
update public.payments set status = 'expired'
  where status = 'pending' and razorpay_subscription_id is null and created_at < now() - interval '1 hour';

-- At most ONE open row per user. create-razorpay-order inserts a 'pending' row BEFORE calling
-- Razorpay; a concurrent second checkout hits this index (23505) and gets 409.
-- Header check: abort clearly if a user already has more than one open row.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT user_id FROM public.payments
    WHERE status IN ('pending', 'active', 'authenticated', 'paused', 'halted') GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF n > 0 THEN
    RAISE EXCEPTION '% users have more than one open payments row; resolve before applying', n;
  END IF;
END $$;

create unique index if not exists payments_one_open_per_user
  on public.payments (user_id)
  where status in ('pending', 'active', 'authenticated', 'paused', 'halted');

create index if not exists payments_needs_refund_idx on public.payments (needs_refund) where needs_refund;

-- Expire stale pending rows hourly, ONLY those without a Razorpay subscription id (Hank B1). Rows with a
-- subscription id are resolved against Razorpay by create-razorpay-order / webhook terminal events.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-pending-checkouts-hourly',
      '17 * * * *',
      $cmd$ update public.payments set status = 'expired'
            where status = 'pending' and razorpay_subscription_id is null
              and created_at < now() - interval '1 hour' $cmd$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed: expire-pending-checkouts-hourly NOT scheduled';
  END IF;
END
$guard$;
