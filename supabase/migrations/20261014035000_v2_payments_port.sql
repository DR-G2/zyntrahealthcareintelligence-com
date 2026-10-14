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
  ALTER TABLE public.payments ALTER COLUMN currency SET DEFAULT 'AUD';
  ALTER TABLE public.payments ALTER COLUMN status SET DEFAULT 'pending'; -- Gus R7 O2: never default to an open+entitling status
END
$relax$;

create index if not exists idx_payments_user_id on public.payments (user_id);
create index if not exists idx_payments_razorpay_subscription_id on public.payments (razorpay_subscription_id);
create unique index if not exists idx_payments_paypal_order_id on public.payments (paypal_order_id) where paypal_order_id is not null;
create unique index if not exists idx_payments_paypal_subscription_id on public.payments (paypal_subscription_id) where paypal_subscription_id is not null;

alter table public.payments enable row level security;
-- Hank B1: exactly ONE policy on payments: payments_select_own, SELECT TO authenticated USING (auth.uid() = user_id).
-- V2 already has payments_select_own (TO public); the old project has "Users can view own payments" (TO public).
-- Both are replaced by the single TO authenticated policy (no duplicate).
drop policy if exists "Users can view own payments" on public.payments;
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select to authenticated using (auth.uid() = user_id);
DO $polchk$
DECLARE bad text;
BEGIN
  SELECT string_agg(policyname || ' (' || cmd || ' to ' || roles::text || ' using ' || coalesce(qual, '') || ')', '; ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'payments'
    AND NOT (policyname = 'payments_select_own' AND cmd = 'SELECT' AND roles = ARRAY['authenticated']::name[]
             AND replace(qual, ' ', '') = '(auth.uid()=user_id)' AND with_check IS NULL);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'public.payments has unexpected RLS policies: %', bad;
  END IF;
END
$polchk$;

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

-- No public.admin_roles: admin checks use public.is_admin() over pie.security_admin_allowlist (20261014051000).

-- Hank V2 grants (B1): RLS on; anon nothing; authenticated SELECT (own rows via policy) on payments only;
-- writes service_role only. Explicit table- AND column-level revokes (V2 has per-column SELECT grants and
-- default privileges that grant arwdDxtm to anon/authenticated on new tables).
DO $rev$
DECLARE t text; c text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payments', 'manual_overrides'] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
    FOR c IN SELECT attname FROM pg_attribute WHERE attrelid = format('public.%I', t)::regclass AND attnum > 0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON TABLE public.%I FROM anon, authenticated, PUBLIC', c, t);
    END LOOP;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$rev$;
grant select on table public.payments to authenticated;

-- Self-check (B1): every table privilege for anon/authenticated/PUBLIC, plus every column-level ACL entry.
DO $chk$
DECLARE bad text;
BEGIN
  SELECT string_agg(x, ', ') INTO bad FROM (
    -- table level
    SELECT r || ':' || t || ':' || p AS x
    FROM unnest(ARRAY['payments', 'manual_overrides']) t,
         unnest(ARRAY['anon', 'authenticated']) r,
         unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
    WHERE has_table_privilege(r, format('public.%I', t), p)
      AND NOT (t = 'payments' AND r = 'authenticated' AND p = 'SELECT')
    UNION ALL
    -- column level (pg_attribute.attacl holds ONLY column grants, not inherited table grants)
    SELECT coalesce(g.rolname, 'PUBLIC') || ':' || c.relname || '.' || a.attname || ':' || acl.privilege_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
    CROSS JOIN LATERAL aclexplode(a.attacl) acl
    LEFT JOIN pg_roles g ON g.oid = acl.grantee
    WHERE c.relname IN ('payments', 'manual_overrides')
      AND (acl.grantee = 0 OR g.rolname IN ('anon', 'authenticated'))
    UNION ALL
    SELECT 'RLS off:' || c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('payments', 'manual_overrides') AND NOT c.relrowsecurity
  ) q;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'unexpected privileges on billing tables: %', bad;
  END IF;
END
$chk$;
