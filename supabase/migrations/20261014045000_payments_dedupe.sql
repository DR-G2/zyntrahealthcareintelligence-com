-- Reviewed, NON-DESTRUCTIVE dedupe so 20261014050000 (unique payment id) and 20261014060000
-- (one open row per user) do not abort on real data. NOT applied live by this PR.
-- Nothing is deleted: losing rows get status 'superseded' plus an audit trail.
-- Run the PREVIEW queries first and review the output before applying.
--
-- PREVIEW 1 (duplicate payment ids):
--   select razorpay_payment_id, array_agg(id order by created_at desc) ids, count(*)
--   from public.payments where razorpay_payment_id is not null group by 1 having count(*) > 1;
-- PREVIEW 2 (users with >1 open row):
--   select user_id, array_agg(id || ':' || status order by created_at desc), count(*)
--   from public.payments where status in ('pending','active','authenticated','paused','halted') group by 1 having count(*) > 1;
-- BACKFILL AUDIT (rows that now fail closed: no dates and not legacy 'lifetime'; check-subscription
-- backfills current_period_end from Razorpay on the user's next check, or set it manually):
--   select id, user_id, tier, status, razorpay_subscription_id, razorpay_order_id, created_at
--   from public.payments
--   where status = 'active' and trial_end_at is null and current_period_end is null and tier <> 'lifetime';
--   -- manual backfill example (after confirming the paid-through date at Razorpay):
--   -- update public.payments set current_period_end = '<iso date>' where id = '<id>';

alter table public.payments
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_reason text,
  add column if not exists superseded_payment_id text;

-- 1) Duplicate razorpay_payment_id: keep the newest row (prefer status 'active'); others superseded.
--    The losing row's payment id moves to superseded_payment_id so the UNIQUE constraint can be added.
with ranked as (
  select id, row_number() over (
           partition by razorpay_payment_id
           order by (status = 'active') desc, created_at desc, id desc) as rn
  from public.payments
  where razorpay_payment_id is not null
)
update public.payments p
set status = 'superseded',
    superseded_at = now(),
    superseded_reason = 'duplicate razorpay_payment_id (20261014045000)',
    superseded_payment_id = p.razorpay_payment_id,
    razorpay_payment_id = null
from ranked r
where p.id = r.id and r.rn > 1;

-- 2) More than one open row per user: keep the newest valid one (active > authenticated > paused/halted > pending).
with ranked as (
  select id, row_number() over (
           partition by user_id
           order by case status when 'active' then 0 when 'authenticated' then 1 when 'paused' then 2 when 'halted' then 2 else 3 end,
                    created_at desc, id desc) as rn
  from public.payments
  where status in ('pending', 'active', 'authenticated', 'paused', 'halted')
)
update public.payments p
set status = 'superseded',
    superseded_at = now(),
    superseded_reason = 'extra open row for user (20261014045000)'
from ranked r
where p.id = r.id and r.rn > 1;
-- NOTE: a superseded row that still has a live Razorpay subscription keeps billing at Razorpay. Review:
--   select id, user_id, razorpay_subscription_id from public.payments
--   where superseded_reason like 'extra open row%' and razorpay_subscription_id is not null;
-- and cancel those subscriptions at Razorpay / refund as appropriate.
