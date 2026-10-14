import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { timingSafeEqual, hmacSha256Hex, verifyHmacSignature } from '../../supabase/functions/_shared/signature';
import { entitlementFromRow, RENEWAL_GRACE_HOURS } from '../../supabase/functions/_shared/billing-lifecycle';
import { firstChargeUnix, trialEndDate, sydneyDate, renewalDate, periodEnd } from '../../supabase/functions/_shared/billing-dates';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('constant-time signature verification', () => {
  it('timingSafeEqual', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
  it('verifies a correct Razorpay-style HMAC and rejects tampering / empty secret', async () => {
    const sig = await hmacSha256Hex('order_1|pay_1', 'secret');
    expect(await verifyHmacSignature('order_1|pay_1', sig, 'secret')).toBe(true);
    expect(await verifyHmacSignature('order_1|pay_2', sig, 'secret')).toBe(false);
    expect(await verifyHmacSignature('order_1|pay_1', sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0'), 'secret')).toBe(false);
    expect(await verifyHmacSignature('order_1|pay_1', sig, '')).toBe(false);
    expect(await verifyHmacSignature('order_1|pay_1', '', 'secret')).toBe(false);
  });
  it('no plain === signature compare remains in the Razorpay functions', () => {
    for (const f of ['supabase/functions/verify-razorpay-payment/index.ts', 'supabase/functions/razorpay-webhook/index.ts']) {
      const src = read(f);
      expect(src).toContain('verifyHmacSignature');
      expect(src).not.toMatch(/hex\s*===\s*signature/);
    }
  });
});

describe('replay protection wiring', () => {
  it('migration adds UNIQUE(razorpay_payment_id)', () => {
    expect(read('supabase/migrations/20261014050000_payments_replay_protection.sql')).toMatch(/unique \(razorpay_payment_id\)/i);
  });
  it('verify path no-ops on an already-recorded payment id and upserts with ignoreDuplicates', () => {
    const src = read('supabase/functions/verify-razorpay-payment/index.ts');
    expect(src).toContain('.eq("razorpay_payment_id", razorpay_payment_id)');
    expect(src).toContain('already_recorded: true');
    expect(src).toContain('onConflict: "razorpay_payment_id", ignoreDuplicates: true');
  });
  it('create path keeps Sydney start_at (not now + 7*86400)', () => {
    const src = read('supabase/functions/create-razorpay-order/index.ts');
    expect(src).toContain('firstChargeUnix(');
    expect(src).not.toMatch(/7\s*\*\s*86400/);
  });
});

describe('server-side entitlement from stored dates', () => {
  const now = new Date('2026-10-14T00:00:00Z');
  const iso = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();
  it('trial in progress', () => expect(entitlementFromRow({ status: 'active', trial_end_at: iso(24), current_period_end: iso(24) }, now)).toMatchObject({ entitled: true, reason: 'trial' }));
  it('paid period in progress', () => expect(entitlementFromRow({ status: 'active', trial_end_at: iso(-500), current_period_end: iso(100) }, now)).toMatchObject({ entitled: true, reason: 'paid' }));
  it('cancelled: access until period end, then none (no grace)', () => {
    expect(entitlementFromRow({ status: 'active', current_period_end: iso(1), cancel_at_period_end: true }, now).entitled).toBe(true);
    expect(entitlementFromRow({ status: 'active', current_period_end: iso(-1), cancel_at_period_end: true }, now)).toMatchObject({ entitled: false, reason: 'cancelled_expired' });
  });
  it('lapsed renewal: grace then expiry', () => {
    expect(entitlementFromRow({ status: 'active', current_period_end: iso(-(RENEWAL_GRACE_HOURS - 1)) }, now)).toMatchObject({ entitled: true, reason: 'renewal_grace' });
    expect(entitlementFromRow({ status: 'active', current_period_end: iso(-(RENEWAL_GRACE_HOURS + 1)) }, now)).toMatchObject({ entitled: false, reason: 'period_expired' });
  });
  it('trial ended with no renewal recorded expires after grace', () => {
    expect(entitlementFromRow({ status: 'active', trial_end_at: iso(-72) }, now).entitled).toBe(false);
  });
  it('non-active rows never entitle', () => {
    expect(entitlementFromRow({ status: 'cancelled', current_period_end: iso(100) }, now).entitled).toBe(false);
    expect(entitlementFromRow(null, now).entitled).toBe(false);
  });
  it('check-subscription no longer fails open on Razorpay errors', () => {
    const src = read('supabase/functions/check-subscription/index.ts');
    expect(src).toContain('entitlementFromRow(row)');
    expect(src).not.toContain('Razorpay API check failed, using local data');
  });
});

describe('month-end / February / DST (Hank)', () => {
  const sydHour = (d: Date) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Sydney', hour: 'numeric', hourCycle: 'h23' }).format(d));
  it('start_at is 10:00 Sydney on the trial-end date on both DST change days', () => {
    // DST ends Sun 5 Apr 2026 (03:00 AEDT -> 02:00 AEST); starts Sun 4 Oct 2026 (02:00 AEST -> 03:00 AEDT)
    for (const signup of ['2026-03-28T13:30:00Z', '2026-03-29T00:00:00Z', '2026-09-26T14:30:00Z', '2026-09-27T00:00:00Z']) {
      const s = new Date(signup);
      const charge = new Date(firstChargeUnix(s) * 1000);
      expect(sydneyDate(charge)).toEqual(trialEndDate(s));
      expect(sydHour(charge)).toBe(10);
    }
  });
  it('signup at Sydney midnight boundary uses the Sydney date', () => {
    expect(trialEndDate(new Date('2026-12-31T13:00:00Z'))).toEqual({ y: 2027, m: 1, d: 8 }); // 1 Jan 00:00 AEDT
    expect(trialEndDate(new Date('2026-12-31T12:59:00Z'))).toEqual({ y: 2027, m: 1, d: 7 }); // 31 Dec 23:59 AEDT
  });
  it('trial ending 22–24 Feb / 28 Feb / 29 Feb (leap) renews correctly', () => {
    expect(renewalDate({ y: 2027, m: 2, d: 28 }, 1)).toEqual({ y: 2027, m: 3, d: 28 });
    expect(renewalDate({ y: 2028, m: 2, d: 29 }, 1)).toEqual({ y: 2028, m: 3, d: 29 });
    expect(renewalDate({ y: 2028, m: 2, d: 29 }, 12)).toEqual({ y: 2029, m: 2, d: 28 });
    expect(renewalDate({ y: 2028, m: 2, d: 29 }, 48)).toEqual({ y: 2032, m: 2, d: 29 });
  });
  it('month-end periods are contiguous (no gap/overlap) across 24 months', () => {
    for (const anchor of [{ y: 2027, m: 1, d: 31 }, { y: 2027, m: 1, d: 30 }, { y: 2027, m: 1, d: 29 }, { y: 2028, m: 1, d: 31 }]) {
      for (let n = 0; n < 24; n++) {
        const end = periodEnd(anchor, n);
        const next = renewalDate(anchor, n + 1);
        const dayAfter = new Date(Date.UTC(end.y, end.m - 1, end.d + 1));
        expect({ y: dayAfter.getUTCFullYear(), m: dayAfter.getUTCMonth() + 1, d: dayAfter.getUTCDate() }).toEqual(next);
      }
    }
  });
  it('3-month plan from 31 Aug clamps Nov/Feb and restores in May/Aug', () => {
    const a = { y: 2027, m: 8, d: 31 };
    expect([1, 2, 3, 4].map((n) => renewalDate(a, n, 'quarterly'))).toEqual([
      { y: 2027, m: 11, d: 30 }, { y: 2028, m: 2, d: 29 }, { y: 2028, m: 5, d: 31 }, { y: 2028, m: 8, d: 31 },
    ]);
  });
});

describe('Gus retest items', () => {
  it('R3: checkout is disabled unless VITE_CHECKOUT_ENABLED=true', () => {
    const src = read('src/lib/razorpay-config.ts');
    expect(src).toContain("import.meta.env.VITE_CHECKOUT_ENABLED === 'true'");
    expect(src).toContain('CHECKOUT_DISABLED = !CHECKOUT_ENABLED');
  });
  it('R1/L2/race: create uses checkoutDecision and reserves a pending row before calling Razorpay', () => {
    const src = read('supabase/functions/create-razorpay-order/index.ts');
    expect(src).toContain('checkoutDecision(history');
    const reserve = src.indexOf('status: "pending"');
    const call = src.indexOf('https://api.razorpay.com/v1/subscriptions');
    expect(reserve).toBeGreaterThan(0);
    expect(reserve).toBeLessThan(call);
    expect(src).toContain('"23505"');
    expect(src).toMatch(/withTrial \? \{\s*start_at/);
  });
  it('R2: webhook-created rows set trial_end_at from entity.start_at', () => {
    expect(read('supabase/functions/razorpay-webhook/index.ts')).toContain('trial_end_at: typeof entity.start_at === "number"');
  });
  it('cron secret compared in constant time', () => {
    expect(read('supabase/functions/trial-reminder-email/index.ts')).toContain('timingSafeEqual(req.headers.get("x-cron-secret")');
  });
});

describe('Gus retest 2', () => {
  it('webhook never inserts subscription rows and flags charges on cancelled subs', () => {
    const src = read('supabase/functions/razorpay-webhook/index.ts');
    // Only audit rows with status 'orphan' may be inserted (never an entitling row).
    const inserts = src.split('from("payments").insert(').slice(1);
    for (const chunk of inserts) expect(chunk.slice(0, 400)).toMatch(/status: "orphan"|razorpay_order_id/);
    expect(src).toContain('needs_refund: true');
    expect(src).toContain('last_razorpay_payment_id');
  });
  it('verify rejects subscriptions that do not match the pending row', () => {
    const src = read('supabase/functions/verify-razorpay-payment/index.ts');
    expect(src).toContain('verifyDecision(userId, razorpay_subscription_id, pend)');
  });
  it('migrations: duplicate guard precedes unique; REVOKE on helper; pending partial unique index', () => {
    const m50 = read('supabase/migrations/20261014050000_payments_replay_protection.sql');
    expect(m50.indexOf('RAISE EXCEPTION')).toBeLessThan(m50.indexOf('add constraint'));
    expect(read('supabase/migrations/20261014051000_entitlement_honours_billing_dates.sql')).toMatch(/REVOKE EXECUTE ON FUNCTION public\.payment_row_entitled\(public\.payments\) FROM PUBLIC, anon/);
    const m60 = read('supabase/migrations/20261014060000_payments_pending_checkout_guard.sql');
    expect(m60).toMatch(/create unique index if not exists payments_one_open_per_user\s+on public\.payments \(user_id\)\s+where status in \('pending', 'active', 'authenticated', 'paused', 'halted'\) and tier is distinct from 'lifetime'/);
    expect(m60).toContain("interval '1 hour'");
  });
  it('v2-ai-lab uses the shared entitlement helper (no inlined copy)', () => {
    const src = read('supabase/functions/v2-ai-lab/_shared/auth.ts');
    expect(src).toContain('from "../../_shared/billing-lifecycle.ts"');
    expect(src).not.toContain('RENEWAL_GRACE_MS');
  });
  it('BillingCard picks cancel copy from stored plan_interval, not amount', () => {
    const src = read('src/components/settings/BillingCard.tsx');
    expect(src).toContain("subscription.plan_interval === 'quarterly'");
    expect(src).not.toContain('plan_amount');
  });
});

describe('Hank B1/B2 + Gus retest 3 wiring', () => {
  it('create sets expire_by and resolves stale pending rows against Razorpay', () => {
    const src = read('supabase/functions/create-razorpay-order/index.ts');
    expect(src).toContain('expire_by: Math.floor((Date.now() + PENDING_TTL_MS) / 1000)');
    expect(src).toContain('pendingRowExpirable(row)');
    expect(src).toContain('resolveStalePending(');
  });
  it('webhook + verify cancel unmatched subscriptions at Razorpay and reconcile crash-before-save', () => {
    for (const f of ['supabase/functions/razorpay-webhook/index.ts', 'supabase/functions/verify-razorpay-payment/index.ts']) {
      const src = read(f);
      expect(src).toContain('cancelSubscriptionNow(');
      expect(src).toContain('reconcilesPendingRow(');
    }
  });
  it('cancel-now helper is idempotent (never throws, cancel_at_cycle_end 0)', () => {
    const src = read('supabase/functions/_shared/razorpay.ts');
    expect(src).toContain('cancel_at_cycle_end: 0');
    expect(src).toMatch(/catch \(e\)/);
  });
  it('verify treats 0 updated rows as failure; webhook error body is generic', () => {
    expect(read('supabase/functions/verify-razorpay-payment/index.ts')).toContain('!updated?.length');
    expect(read('supabase/functions/razorpay-webhook/index.ts')).toContain('error: "processing_failed"');
  });
  it('migrations: dedupe precedes unique/open index; cron guarded; paused/halted open; cron expiry skips rows with sub id', () => {
    const files = ['20261014040000_billing_cancel_and_trial_reminders.sql', '20261014045000_payments_dedupe.sql', '20261014050000_payments_replay_protection.sql', '20261014060000_payments_pending_checkout_guard.sql'];
    expect([...files].sort()).toEqual(files);
    const dedupe = read('supabase/migrations/20261014045000_payments_dedupe.sql');
    expect(dedupe).toContain("status = 'superseded'");
    expect(dedupe).not.toMatch(/\bdelete\s+from\b/i);
    for (const f of [files[0], files[3]]) {
      const m = read(`supabase/migrations/${f}`);
      expect(m).toMatch(/IF (NOT )?EXISTS \(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'\)/);
      expect(m).not.toMatch(/^select cron\.schedule/m);
    }
    const m60 = read('supabase/migrations/20261014060000_payments_pending_checkout_guard.sql');
    expect(m60).toContain("where status in ('pending', 'active', 'authenticated', 'paused', 'halted') and tier is distinct from 'lifetime';");
    expect(m60).toContain('razorpay_subscription_id is null');
  });
  it('customer-portal cancel routes through planCancel', () => {
    const src = read('supabase/functions/customer-portal/index.ts');
    expect(src).toContain('planCancel(');
    expect(src).not.toContain('cancel_at_cycle_end: true');
  });
  it('051000 fails closed on undated rows except explicit lifetime', () => {
    expect(read('supabase/migrations/20261014051000_entitlement_honours_billing_dates.sql')).toContain("THEN p.tier = 'lifetime'");
  });
});

describe('Hank round 3', () => {
  it('verify returns idempotent success for an already-active own row and never cancels it', () => {
    const src = read('supabase/functions/verify-razorpay-payment/index.ts');
    expect(src).toContain('verifyDecision(userId, razorpay_subscription_id, pend)');
    const idem = src.indexOf('decision === "idempotent"');
    const cancel = src.indexOf('cancelSubscriptionNow(');
    expect(idem).toBeGreaterThan(0);
    expect(idem).toBeLessThan(cancel);
  });
  it('legacy payment.captured never creates an active row', () => {
    const src = read('supabase/functions/razorpay-webhook/index.ts');
    const legacy = src.slice(src.indexOf('if (event === "payment.captured")'), src.indexOf('if (event === "payment.failed")'));
    expect(legacy).not.toContain('status: "active"');
    expect(legacy).toContain('needs_refund: true');
  });
  it('045000 ranks by entitlement, excludes lifetime from supersede, has cancel list', () => {
    const m = read('supabase/migrations/20261014045000_payments_dedupe.sql');
    expect(m).toContain("(status = 'active' and (current_period_end is not null or trial_end_at is not null or tier = 'lifetime')) desc");
    expect(m).toContain("tier is distinct from 'lifetime'");
    expect(m).toContain('CANCEL LIST');
    expect(read('supabase/migrations/20261014060000_payments_pending_checkout_guard.sql')).toContain("and tier is distinct from 'lifetime';");
  });
});

describe('Hank follow-ups + Gus Retest 4', () => {
  it('payment_row_entitled is not granted to authenticated (called only via SECURITY DEFINER)', () => {
    const m = read('supabase/migrations/20261014051000_entitlement_honours_billing_dates.sql');
    expect(m).not.toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.payment_row_entitled[^;]*TO\s+authenticated/i);
    expect(m).toMatch(/SECURITY DEFINER/i);
  });
  it('061000: refund_payment_id partial unique with dup precheck, needs_cancel, guarded hourly retry', () => {
    const m = read('supabase/migrations/20261014061000_payments_refund_unique_needs_cancel.sql');
    expect(m).toContain('RAISE EXCEPTION');
    expect(m).toMatch(/unique index if not exists payments_refund_payment_id_key[\s\S]*where refund_payment_id is not null/);
    expect(m).toContain('needs_cancel boolean not null default false');
    expect(m).toContain("extname = 'pg_cron'");
    expect(m).toContain('retry-razorpay-cancels');
    expect(read('supabase/migrations/20261014060000_payments_pending_checkout_guard.sql')).toContain('OFF-PEAK');
  });
  it('failed cancels are flagged + alerted; webhook still 200; no maybeSingle on sub-id lookups', () => {
    for (const f of ['razorpay-webhook', 'verify-razorpay-payment', 'create-razorpay-order']) {
      const s = read(`supabase/functions/${f}/index.ts`);
      expect(s).toContain('needs_cancel');
      expect(s).toContain('ALERT NEEDS_CANCEL');
    }
    for (const f of ['razorpay-webhook', 'verify-razorpay-payment']) {
      const s = read(`supabase/functions/${f}/index.ts`);
      expect(s).toContain('pickSubscriptionRow');
      expect(s).not.toMatch(/\.eq\("razorpay_subscription_id", [a-zA-Z_]+\)\s*\.maybeSingle\(\)/);
    }
  });
  it('retry-razorpay-cancels: constant-time cron secret, clears flag on success, no JWT', () => {
    const s = read('supabase/functions/retry-razorpay-cancels/index.ts');
    expect(s).toContain('timingSafeEqual');
    expect(s).toContain('needs_cancel: false');
    // Gus R5 / Hank: oldest first, own secret
    expect(s).toMatch(/\.order\("created_at", \{ ascending: true \}\)[\s\S]*\.limit\(100\)/);
    expect(s).toContain('CANCEL_RETRY_CRON_SECRET');
    expect(s).not.toContain('TRIAL_REMINDER_CRON_SECRET');
    const m = read('supabase/migrations/20261014061000_payments_refund_unique_needs_cancel.sql');
    expect(m).toContain("name = 'cancel_retry_cron_secret'");
    expect(m).not.toContain("name = 'trial_reminder_cron_secret'");
    expect(read('supabase/config.toml')).toMatch(/\[functions\.retry-razorpay-cancels\]\s*verify_jwt = false/);
  });
  it('customer-portal states immediate vs end-of-cycle via cancelMessage', () => {
    const s = read('supabase/functions/customer-portal/index.ts');
    expect(s).toContain('cancelMessage(plan)');
    expect(s).not.toContain('"Subscription will be cancelled at end of billing cycle"');
  });
  it('no raw JS month arithmetic in billing code (use renewalDate)', () => {
    for (const f of ['supabase/functions/_shared/billing-lifecycle.ts', 'supabase/functions/_shared/billing-dates.ts', 'src/lib/billing.ts'])
      expect(read(f)).not.toMatch(/set(UTC)?Month\(/);
  });
});

describe('Gus Retest 5 wiring', () => {
  it('cancelSubscriptionNow checks sub status on failure and treats terminal as success', () => {
    const s = read('supabase/functions/_shared/razorpay.ts');
    expect(s).toContain('fetchSubscription(subscriptionId)');
    expect(s).toContain('cancelAlreadyDone(sub?.status)');
  });
  it('webhook treats ONLY expected-constraint 23505 as no-op success', () => {
    const s = read('supabase/functions/razorpay-webhook/index.ts');
    expect(s).not.toMatch(/isUniqueViolation\(/);
    expect(s).toContain('!isExpectedUniqueViolation(error, [REFUND_PAYMENT_ID_KEY])');
    expect(s).toContain('!isExpectedUniqueViolation(error, [REFUND_PAYMENT_ID_KEY, RAZORPAY_PAYMENT_ID_KEY])');
  });
});

describe('Retest 6 / Hank nits', () => {
  const mig = (prefix: string) => {
    const dir = 'supabase/migrations';
    const f = readdirSync(resolve(process.cwd(), dir)).find((n: string) => n.startsWith(prefix))!;
    return read(`${dir}/${f}`);
  };
  it('N1: duplicate refund_payment_id still persists needs_cancel in a separate update', () => {
    const s = read('supabase/functions/razorpay-webhook/index.ts');
    expect(s.match(/update\(\{ needs_cancel: true \}\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(s).toContain('if (error && !cancelled)');
  });
  it('N2: cancel-retry cron is skipped with a WARNING when Vault project_url / cancel_retry_cron_secret is missing', () => {
    const s = mig('20261014061000');
    expect(s).toContain("name = 'project_url'");
    expect(s).toContain("name = 'cancel_retry_cron_secret' AND coalesce(decrypted_secret, '') <> ''");
    expect(s).toMatch(/RAISE WARNING 'Vault secret .*cancel_retry_cron_secret is MISSING: retry-razorpay-cancels-hourly NOT scheduled/);
    expect(s.indexOf('RAISE WARNING')).toBeLessThan(s.indexOf('PERFORM cron.schedule'));
  });
  it('trial reminder cron has the same Vault guard', () => {
    const s = mig('20261014040000');
    expect(s).toContain("name = 'trial_reminder_cron_secret' AND coalesce(decrypted_secret, '') <> ''");
    expect(s.indexOf('RAISE WARNING')).toBeLessThan(s.indexOf('PERFORM cron.schedule'));
  });
  it('config.toml points at live V2', () => {
    expect(read('supabase/config.toml')).toContain('project_id = "hkowvjazuwebmibssdut"');
  });
  it('verify-paypal only no-ops on PayPal unique indexes', () => {
    const s = read('supabase/functions/verify-paypal-payment/index.ts');
    expect(s).not.toContain('=== "23505"');
    expect(s).toContain('isExpectedUniqueViolation(insertError, [PAYPAL_ORDER_ID_KEY, PAYPAL_SUBSCRIPTION_ID_KEY])');
  });
  it('V2 port: payments columns, RLS and grants', () => {
    const s = mig('20261014035000');
    for (const c of ['razorpay_payment_id', 'razorpay_subscription_id', 'tier', 'paypal_subscription_id']) expect(s).toContain(`add column if not exists ${c}`);
    expect(s).toContain('ALTER COLUMN external_transaction_id DROP NOT NULL');
    expect(s).toContain('alter table public.payments enable row level security');
    expect(s).toContain('revoke all on table public.payments from anon, authenticated, public');
    expect(s).toContain('grant select on table public.payments to authenticated');
    expect(s).not.toMatch(/grant (insert|update|delete)[^;]*to authenticated/i);
    expect(s).toContain('create table if not exists public.manual_overrides');
    expect(s).toContain('create table if not exists public.admin_roles');
  });
  it('V2 port: entitlement helpers have empty search_path and no anon/PUBLIC execute', () => {
    const s = mig('20261014051000');
    expect(s.match(/SET search_path = ''/g)?.length).toBe(2);
    expect(s).toContain('REVOKE EXECUTE ON FUNCTION public.payment_row_entitled(public.payments) FROM PUBLIC, anon');
    expect(s).toContain('REVOKE EXECUTE ON FUNCTION public.current_user_can_read_questions() FROM PUBLIC, anon');
    expect(s).toContain("has_function_privilege('anon'");
  });
  it('check-subscription syncs pending/authenticated rows from Razorpay', () => {
    const s = read('supabase/functions/check-subscription/index.ts');
    expect(s).toContain('razorpaySyncUpdate(sub)');
    expect(s.indexOf('razorpaySyncUpdate(sub)')).toBeLessThan(s.indexOf('// 2. Check local payments'));
  });
});
