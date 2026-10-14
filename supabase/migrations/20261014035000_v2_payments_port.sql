-- V2 port (Hank): makes 20261014040000..061000 apply cleanly on live V2 (hkowvjazuwebmibssdut).
-- NOT applied live by this PR; Gus applies to hkowvjazuwebmibssdut. Idempotent on the old project too.
-- V2 payments (0 rows) was created with a different shape: (id, user_id, provider, external_transaction_id
-- NOT NULL, amount NOT NULL, currency NOT NULL, product_key, status, metadata, created_at, updated_at) and
-- has no tier / razorpay_* / paypal_* columns, no manual_overrides / admin_roles, no paid-check helpers.

alter table public.payments
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_subscription_id text,
  add column if not exists tier text not null default 'free',
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists paypal_subscription_id text;

-- Edge functions insert pending/orphan rows without these; relax V2-only NOT NULLs (no-op if already nullable).
DO $relax$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='external_transaction_id') THEN
    ALTER TABLE public.payments ALTER COLUMN external_transaction_id DROP NOT NULL;
  END IF;
  ALTER TABLE public.payments ALTER COLUMN amount DROP NOT NULL;
  ALTER TABLE public.payments ALTER COLUMN provider SET DEFAULT 'razorpay';
  ALTER TABLE public.payments ALTER COLUMN currency SET DEFAULT 'INR';
  ALTER TABLE public.payments ALTER COLUMN status SET DEFAULT 'active';
END
$relax$;

create index if not exists idx_payments_user_id on public.payments (user_id);
create index if not exists idx_payments_razorpay_subscription_id on public.payments (razorpay_subscription_id);
create unique index if not exists idx_payments_paypal_order_id on public.payments (paypal_order_id) where paypal_order_id is not null;
create unique index if not exists idx_payments_paypal_subscription_id on public.payments (paypal_subscription_id) where paypal_subscription_id is not null;

alter table public.payments enable row level security;
DO $pol$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='Users can view own payments') THEN
    CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$pol$;

-- Objects referenced by current_user_can_read_questions() (20261014051000) and check-subscription.
create table if not exists public.manual_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  tier text not null default 'full_access',
  granted_by text,
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.manual_overrides enable row level security; -- service role only

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('super_admin', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security; -- service role only; seed admins separately

-- Hank V2 grants: RLS on; anon nothing; authenticated SELECT own rows only (policy above); writes service_role only.
revoke all on table public.payments from anon, authenticated, public;
grant select on table public.payments to authenticated;
grant select, insert, update, delete on table public.payments to service_role;
revoke all on table public.manual_overrides from anon, authenticated, public;
grant select, insert, update, delete on table public.manual_overrides to service_role;
revoke all on table public.admin_roles from anon, authenticated, public;
grant select, insert, update, delete on table public.admin_roles to service_role;

DO $chk$
BEGIN
  IF has_table_privilege('anon', 'public.payments', 'SELECT')
     OR has_table_privilege('authenticated', 'public.payments', 'INSERT')
     OR has_table_privilege('authenticated', 'public.payments', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.payments', 'DELETE')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payments'::regclass) THEN
    RAISE EXCEPTION 'payments grants/RLS not as required (anon none, authenticated SELECT only, RLS on)';
  END IF;
END
$chk$;
