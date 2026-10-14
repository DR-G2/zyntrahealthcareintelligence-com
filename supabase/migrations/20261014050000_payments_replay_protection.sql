-- Replay protection: a Razorpay payment id may be recorded at most once.
-- NOT applied live by this PR.
--
-- STEP 1 (header guard): abort with a clear message if duplicates already exist. Nothing is changed.
--   Manual check: select razorpay_payment_id, count(*) from public.payments
--                 where razorpay_payment_id is not null group by 1 having count(*) > 1;
DO $$
DECLARE dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT razorpay_payment_id FROM public.payments
    WHERE razorpay_payment_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'payments has % duplicated razorpay_payment_id values; resolve before applying', dup_count;
  END IF;
END $$;

-- STEP 2: full UNIQUE constraint (NULLs stay distinct) so upsert onConflict can target it.
alter table public.payments
  add constraint payments_razorpay_payment_id_key unique (razorpay_payment_id);
