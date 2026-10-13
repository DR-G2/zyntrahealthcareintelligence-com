import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
    expect(src).toContain('matchesPendingRow(userId, razorpay_subscription_id, pend)');
  });
  it('migrations: duplicate guard precedes unique; REVOKE on helper; pending partial unique index', () => {
    const m50 = read('supabase/migrations/20261014050000_payments_replay_protection.sql');
    expect(m50.indexOf('RAISE EXCEPTION')).toBeLessThan(m50.indexOf('add constraint'));
    expect(read('supabase/migrations/20261014051000_entitlement_honours_billing_dates.sql')).toMatch(/REVOKE EXECUTE ON FUNCTION public\.payment_row_entitled\(public\.payments\) FROM anon, public/);
    const m60 = read('supabase/migrations/20261014060000_payments_pending_checkout_guard.sql');
    expect(m60).toMatch(/create unique index if not exists payments_one_open_per_user\s+on public\.payments \(user_id\)\s+where status in \('pending', 'active', 'authenticated', 'paused', 'halted'\)/);
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
      expect(m).toContain("IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')");
      expect(m).not.toMatch(/^select cron\.schedule/m);
    }
    const m60 = read('supabase/migrations/20261014060000_payments_pending_checkout_guard.sql');
    expect(m60).toContain("where status in ('pending', 'active', 'authenticated', 'paused', 'halted');");
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
