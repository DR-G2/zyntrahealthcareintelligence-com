-- Checkout race guard + refund flagging + plan interval. NOT applied live by this PR.
-- Requires 20261014040000 and 20261014050000.

alter table public.payments
  add column if not exists plan_interval text check (plan_interval in ('monthly', 'quarterly')),
  add column if not exists needs_refund boolean not null default false,
  add column if not exists refund_payment_id text,
  add column if not exists last_razorpay_payment_id text;

-- Expire abandoned checkouts before creating the index (otherwise it could fail on legacy data).
update public.payments set status = 'expired'
  where status = 'pending' and created_at < now() - interval '1 hour';

-- At most ONE open row per user. create-razorpay-order inserts a 'pending' row BEFORE calling
-- Razorpay; a concurrent second checkout hits this index (23505) and gets 409.
-- Header check: abort clearly if a user already has more than one open row.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT user_id FROM public.payments
    WHERE status IN ('pending', 'active', 'authenticated') GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF n > 0 THEN
    RAISE EXCEPTION '% users have more than one open payments row; resolve before applying', n;
  END IF;
END $$;

create unique index if not exists payments_one_open_per_user
  on public.payments (user_id)
  where status in ('pending', 'active', 'authenticated');

create index if not exists payments_needs_refund_idx on public.payments (needs_refund) where needs_refund;

-- Expire stale pending rows hourly (create-razorpay-order also expires the caller's own at insert time).
select cron.schedule(
  'expire-pending-checkouts-hourly',
  '17 * * * *',
  $$ update public.payments set status = 'expired'
     where status = 'pending' and created_at < now() - interval '1 hour' $$
);
