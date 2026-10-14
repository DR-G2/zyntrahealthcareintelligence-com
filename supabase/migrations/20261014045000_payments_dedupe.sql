-- Reviewed, NON-DESTRUCTIVE dedupe so 20261014050000 (unique payment id) and 20261014060000
-- (one open row per user) do not abort on real data. NOT applied live by this PR.
-- Nothing is deleted: losing rows get status 'superseded' plus an audit trail.
-- Run the PREVIEW queries first and review the output before applying.
--
-- PREVIEW 1 (duplicate payment ids):
--   select razorpay_payment_id, array_agg(id order by created_at desc) ids, count(*)
--   from public.payments where razorpay_payment_id is not null group by 1 having count(*) > 1;
-- PREVIEW 2 (users with >1 open non-lifetime row):
--   select user_id, array_agg(id || ':' || status order by created_at desc), count(*)
--   from public.payments where status in ('pending','active','authenticated','paused','halted') and tier is distinct from 'lifetime' group by 1 having count(*) > 1;
-- BACKFILL AUDIT (rows that now fail closed: no dates and not legacy 'lifetime'; check-subscription
-- backfills current_period_end from Razorpay on the user's next check, or set it manually):
--   select id, user_id, tier, status, razorpay_subscription_id, razorpay_order_id, created_at
--   from public.payments
--   where status = 'active' and trial_end_at is null and current_period_end is null and tier <> 'lifetime';
--   -- manual backfill example (after confirming the paid-through date at Razorpay):
--   -- update public.payments set current_period_end = '<iso date>' where id = '<id>';

-- CANCEL LIST (run AFTER applying; every superseded row that still carries a Razorpay subscription id —
-- check each at Razorpay and cancel/refund if still live):
--   select id, user_id, status, razorpay_subscription_id, superseded_reason, superseded_at
--   from public.payments
--   where status = 'superseded' and razorpay_subscription_id is not null
--   order by superseded_at;
--
alter table public.payments
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_reason text,
  add column if not exists superseded_payment_id text;

-- 1) Duplicate razorpay_payment_id: keep the newest row (prefer status 'active'); others superseded.
--    The losing row's payment id moves to superseded_payment_id so the UNIQUE constraint can be added.
with ranked as (
  select id, row_number() over (
           partition by razorpay_payment_id
           -- keep the row that actually entitles: active AND (dated OR legacy lifetime) first
           order by (status = 'active' and (current_period_end is not null or trial_end_at is not null or tier = 'lifetime')) desc,
                    (status = 'active') desc, created_at desc, id desc) as rn
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

-- 2) More than one open (non-lifetime) row per user: keep the entitling one (active + dated) first, then
--    active > authenticated > paused/halted > pending, newest first.
with ranked as (
  select id, row_number() over (
           partition by user_id
           order by (status = 'active' and (current_period_end is not null or trial_end_at is not null)) desc,
                    case status when 'active' then 0 when 'authenticated' then 1 when 'paused' then 2 when 'halted' then 2 else 3 end,
                    created_at desc, id desc) as rn
  from public.payments
  -- legacy lifetime rows are never superseded (and are outside the one-open-row index, see 060000)
  where status in ('pending', 'active', 'authenticated', 'paused', 'halted') and tier is distinct from 'lifetime'
)
update public.payments p
set status = 'superseded',
    superseded_at = now(),
    superseded_reason = 'extra open row for user (20261014045000)'
from ranked r
where p.id = r.id and r.rn > 1;
-- After applying: run the CANCEL LIST query in the header.
