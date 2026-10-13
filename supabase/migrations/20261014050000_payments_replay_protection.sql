-- Replay protection: a Razorpay payment id may be recorded at most once.
-- NOT applied live by this PR. A full UNIQUE constraint (NULLs stay distinct in Postgres) is used so that
-- supabase-js upsert(..., { onConflict: "razorpay_payment_id" }) can target it.
-- Before applying, check for existing duplicates (the ALTER fails safely if any exist):
--   select razorpay_payment_id, count(*) from public.payments
--   where razorpay_payment_id is not null group by 1 having count(*) > 1;
alter table public.payments
  add constraint payments_razorpay_payment_id_key unique (razorpay_payment_id);
