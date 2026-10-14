-- Hank follow-up 3 + Gus Retest 4 #1. NOT applied live by this PR. Requires 20261014060000.
-- OFF-PEAK: run in a low-traffic window (index build briefly blocks writes to public.payments).

-- Gus R4 #1: a failed Razorpay cancel is flagged here and retried hourly by retry-razorpay-cancels.
alter table public.payments add column if not exists needs_cancel boolean not null default false;
create index if not exists payments_needs_cancel_idx on public.payments (id) where needs_cancel;

-- Hank 3: one audit/refund row per Razorpay payment id. Precheck so the index never fails half-way.
DO $pre$
DECLARE dup int;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT refund_payment_id FROM public.payments
    WHERE refund_payment_id IS NOT NULL GROUP BY refund_payment_id HAVING count(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE EXCEPTION 'payments.refund_payment_id has % duplicated value(s); resolve before applying. Inspect: select refund_payment_id, array_agg(id) from public.payments where refund_payment_id is not null group by 1 having count(*) > 1;', dup;
  END IF;
END
$pre$;

create unique index if not exists payments_refund_payment_id_key
  on public.payments (refund_payment_id) where refund_payment_id is not null;

-- Hourly retry of failed cancels. Own secret (Hank): Vault 'cancel_retry_cron_secret' == edge env
-- CANCEL_RETRY_CRON_SECRET (create it before applying). Uses Vault 'project_url' from 20261014040000. Guarded.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule(
  'retry-razorpay-cancels-hourly',
  '23 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/retry-razorpay-cancels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cancel_retry_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
  ELSE
    RAISE NOTICE 'pg_cron/pg_net not installed: retry-razorpay-cancels-hourly NOT scheduled';
  END IF;
END
$guard$;
