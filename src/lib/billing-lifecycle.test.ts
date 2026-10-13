import { describe, it, expect, vi } from 'vitest';
import {
  authorizeCancel, planCancel, checkoutDecision, matchesPendingRow, orphanAction, pendingRowExpirable, resolveStalePending,
  pickEntitledRow, entitlementFromRow, reconcilesPendingRow, provisionalPeriodEnd, verifyDecision, pickSubscriptionRow, cancelMessage, planCancel, selectTrialReminders, sendTrialReminders, trialReminderText,
  type PaymentRow, type RazorpaySub, type ReminderStore,
} from '../../supabase/functions/_shared/billing-lifecycle';

const ME = 'user-a', OTHER = 'user-b';
const row = (o: Partial<PaymentRow> = {}): PaymentRow => ({ id: 'p1', user_id: ME, razorpay_subscription_id: 'sub_1', status: 'active', tier: 'full_access', amount: 39, ...o });
const sub = (o: Partial<RazorpaySub> = {}): RazorpaySub => ({ id: 'sub_1', status: 'authenticated', start_at: 2_000_000_000, notes: { user_id: ME }, ...o });

describe('cancel authorization', () => {
  it('allows the owner', () => expect(authorizeCancel(ME, row(), sub())).toEqual({ ok: true }));
  it('rejects a row owned by someone else', () => expect(authorizeCancel(ME, row({ user_id: OTHER }), sub())).toMatchObject({ ok: false, status: 403 }));
  it('rejects when Razorpay notes name another user', () => expect(authorizeCancel(ME, row(), sub({ notes: { user_id: OTHER } }))).toMatchObject({ ok: false, status: 403 }));
  it('rejects when provider subscription id differs from the row', () => expect(authorizeCancel(ME, row(), sub({ id: 'sub_x' }))).toMatchObject({ ok: false, status: 404 }));
  it('404 when no subscription', () => expect(authorizeCancel(ME, null, null)).toMatchObject({ ok: false, status: 404 }));
  it('409 when already cancelled', () => {
    expect(authorizeCancel(ME, row(), sub({ status: 'cancelled' }))).toMatchObject({ ok: false, status: 409 });
    expect(authorizeCancel(ME, row({ cancel_at_period_end: true }), sub())).toMatchObject({ ok: false, status: 409 });
  });
});

describe('cancel timing', () => {
  const now = new Date('2026-10-15T00:00:00Z');
  it('in trial: cancel immediately (no A$39 charge)', () => {
    const p = planCancel(sub({ start_at: Math.floor(now.getTime() / 1000) + 3 * 86400, paid_count: 0 }), now);
    expect(p).toMatchObject({ inTrial: true, cancelAtCycleEnd: 0 });
    expect(p.accessEndsAt).toEqual(now);
  });
  it('R4: start_at passed but first charge still pending -> cancel now (no later A$39), not at cycle end', () => {
    const p = planCancel(sub({ status: 'active', start_at: Math.floor(now.getTime() / 1000) - 3600, paid_count: 0, current_end: null }), now);
    expect(p).toMatchObject({ inTrial: true, cancelAtCycleEnd: 0 });
  });
  it('L1: paid_count 0 is immediate even if current_end is set (first charge retrying)', () => {
    const p = planCancel(sub({ status: 'pending', start_at: 1_700_000_000, paid_count: 0, current_end: Math.floor(now.getTime() / 1000) + 86400 }), now);
    expect(p).toMatchObject({ inTrial: true, cancelAtCycleEnd: 0 });
  });
  it('paid: cancel at cycle end, access to current_end', () => {
    const end = Math.floor(now.getTime() / 1000) + 20 * 86400;
    const p = planCancel(sub({ status: 'active', start_at: 1_700_000_000, paid_count: 1, current_end: end }), now);
    expect(p).toMatchObject({ inTrial: false, cancelAtCycleEnd: 1 });
    expect(p.accessEndsAt.getTime()).toBe(end * 1000);
  });
});

describe('trial reminder selection + idempotency', () => {
  const now = new Date('2026-10-14T00:00:00Z');
  const at = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString();
  const rows = [
    row({ id: 'due', trial_end_at: at(60) }),
    row({ id: 'too-soon', trial_end_at: at(47) }),
    row({ id: 'too-late', trial_end_at: at(72) }),
    row({ id: 'already', trial_end_at: at(55), trial_reminder_sent_at: at(-1) }),
    row({ id: 'cancelled', trial_end_at: at(55), cancel_at_period_end: true }),
    row({ id: 'inactive', trial_end_at: at(55), status: 'cancelled' }),
  ];
  it('selects only trials ending 48–72h out, unsent, active, not cancelled', () => {
    expect(selectTrialReminders(rows, now).map((r) => r.id)).toEqual(['due']);
  });
  it('copy', () => {
    expect(trialReminderText(new Date('2026-10-20T23:00:00Z'), 39)).toBe("Your Zyntra free trial ends on 21 October 2026. If you don't cancel, we'll charge A$39 on that date. Cancel anytime in Settings > Billing.");
  });
  it('sends once across concurrent/repeated runs', async () => {
    const sentAt = new Map<string, Date>();
    const store: ReminderStore = {
      claim: async (id, t) => (sentAt.has(id) ? false : (sentAt.set(id, t), true)),
      release: async (id) => { sentAt.delete(id); },
      emailFor: async () => 'a@example.com',
    };
    const send = vi.fn(async () => {});
    const r1 = await sendTrialReminders(rows, store, { send }, now);
    const r2 = await sendTrialReminders(rows, store, { send }, now); // stale rows, claim blocks
    expect(r1).toMatchObject({ sent: 1 });
    expect(r2).toMatchObject({ sent: 0, skipped: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('releases the claim when the send fails so the next run retries', async () => {
    const sentAt = new Set<string>();
    const store: ReminderStore = {
      claim: async (id) => (sentAt.has(id) ? false : (sentAt.add(id), true)),
      release: async (id) => { sentAt.delete(id); },
      emailFor: async () => 'a@example.com',
    };
    const r = await sendTrialReminders(rows, store, { send: async () => { throw new Error('down'); } }, now);
    expect(r).toMatchObject({ failed: 1 });
    expect(sentAt.size).toBe(0);
  });
});

describe('checkout eligibility (L2) and pending-row matching (race)', () => {
  it('new customer gets a trial', () => expect(checkoutDecision([])).toEqual({ ok: true, trial: true }));
  it('open pending/active/authenticated row -> 409', () => {
    for (const status of ['pending', 'active', 'authenticated', 'paused', 'halted']) expect(checkoutDecision([{ status }]).ok).toBe(false);
  });
  it('lapsed/cancelled/expired paid customer resubscribes WITHOUT trial', () => {
    expect(checkoutDecision([{ status: 'cancelled', razorpay_subscription_id: 'sub_1', trial_end_at: '2026-01-01T00:00:00Z' }])).toEqual({ ok: true, trial: false });
    expect(checkoutDecision([{ status: 'cancelled', razorpay_subscription_id: 'sub_1' }])).toEqual({ ok: true, trial: false });
  });
  it('previous trial (even cancelled in trial) blocks a new trial', () => {
    expect(checkoutDecision([{ status: 'cancelled', trial_end_at: '2026-01-01T00:00:00Z' }])).toEqual({ ok: true, trial: false });
  });
  it('abandoned (expired, never subscribed) checkout keeps trial eligibility', () => {
    expect(checkoutDecision([{ status: 'expired', razorpay_subscription_id: null, trial_end_at: null }])).toEqual({ ok: true, trial: true });
    expect(checkoutDecision([{ status: 'expired', razorpay_subscription_id: 'sub_abandoned', trial_end_at: null }])).toEqual({ ok: true, trial: false }); // N1: reached Razorpay => trial used
  });
  it('matchesPendingRow', () => {
    const r = { user_id: ME, status: 'pending', razorpay_subscription_id: 'sub_1' };
    expect(matchesPendingRow(ME, 'sub_1', r)).toBe(true);
    expect(matchesPendingRow(OTHER, 'sub_1', r)).toBe(false);
    expect(matchesPendingRow(ME, 'sub_2', r)).toBe(false);
    expect(matchesPendingRow(ME, 'sub_1', { ...r, status: 'active' })).toBe(false);
    expect(matchesPendingRow(ME, 'sub_1', null)).toBe(false);
  });
});

describe('orphan handling (Hank B1 / Gus N1)', () => {
  it('orphanAction', () => {
    expect(orphanAction(null, true, true)).toBe('cancel_and_refund');
    expect(orphanAction(null, true, false)).toBe('cancel');
    for (const status of ['expired', 'cancelled', 'superseded', 'orphan']) expect(orphanAction({ status }, true, true)).toBe('cancel_and_refund');
    expect(orphanAction({ status: 'pending' }, true, true)).toBe('none');
    expect(orphanAction({ status: 'active' }, true, true)).toBe('none');
    expect(orphanAction(null, false, false)).toBe('none'); // e.g. cancelled event for unknown sub
  });
  it('only pending rows WITHOUT a subscription id expire blindly', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const old = '2026-10-14T10:00:00Z', fresh = '2026-10-14T11:30:00Z';
    expect(pendingRowExpirable({ status: 'pending', razorpay_subscription_id: null, created_at: old }, now)).toBe(true);
    expect(pendingRowExpirable({ status: 'pending', razorpay_subscription_id: 'sub_1', created_at: old }, now)).toBe(false);
    expect(pendingRowExpirable({ status: 'pending', razorpay_subscription_id: null, created_at: fresh }, now)).toBe(false);
  });
  it('stale pending with sub id resolved by Razorpay state', () => {
    expect(resolveStalePending('cancelled')).toBe('expire');
    expect(resolveStalePending('expired')).toBe('expire');
    expect(resolveStalePending('created')).toBe('cancel_then_expire');
    expect(resolveStalePending('authenticated')).toBe('keep');
    expect(resolveStalePending('active')).toBe('keep');
    expect(resolveStalePending(null)).toBe('keep'); // provider unreachable: never orphan a possibly-live sub
  });
  it('reconcile crash-before-save via notes.pending_payment_id', () => {
    const row = { id: 'p9', user_id: ME, status: 'pending', razorpay_subscription_id: null };
    expect(reconcilesPendingRow(ME, { user_id: ME, pending_payment_id: 'p9' }, row)).toBe(true);
    expect(reconcilesPendingRow(ME, { user_id: OTHER, pending_payment_id: 'p9' }, row)).toBe(false);
    expect(reconcilesPendingRow(ME, { user_id: ME, pending_payment_id: 'p9' }, { ...row, razorpay_subscription_id: 'sub_x' })).toBe(false);
    expect(reconcilesPendingRow(ME, { user_id: ME, pending_payment_id: 'p9' }, { ...row, status: 'expired' })).toBe(false);
  });
});

describe('fail-closed entitlement + aligned row selection', () => {
  const now = new Date('2026-10-14T00:00:00Z');
  it('undated subscription row is NOT entitled; explicit legacy lifetime is', () => {
    expect(entitlementFromRow({ status: 'active', tier: 'full_access' }, now)).toMatchObject({ entitled: false, reason: 'no_period_recorded' });
    expect(entitlementFromRow({ status: 'active', tier: 'lifetime' }, now)).toMatchObject({ entitled: true, reason: 'legacy_lifetime' });
  });
  it('no-trial resubscribe gets a provisional dated period (not unlimited)', () => {
    const end = provisionalPeriodEnd('monthly', now);
    expect(end).toBe('2026-11-13T23:00:00.000Z'); // 14 Nov 10:00 AEDT
    expect(provisionalPeriodEnd('quarterly', now)).toBe('2027-01-13T23:00:00.000Z');
    // Retest 4 nit: no JS month overflow (31 Jan + 1 month = 28 Feb, not 3 Mar)
    expect(provisionalPeriodEnd('monthly', new Date('2027-01-31T00:00:00Z'))).toBe('2027-02-27T23:00:00.000Z');
    expect(provisionalPeriodEnd('monthly', new Date('2028-01-31T00:00:00Z'))).toBe('2028-02-28T23:00:00.000Z');
    expect(entitlementFromRow({ status: 'active', tier: 'full_access', current_period_end: end }, new Date('2026-12-01T00:00:00Z')).entitled).toBe(false);
  });
  it('pickEntitledRow: any entitled row wins over a newer expired one', () => {
    const rows = [
      { status: 'active', tier: 'full_access', current_period_end: '2026-01-01T00:00:00Z' },
      { status: 'active', tier: 'full_access', current_period_end: '2026-12-01T00:00:00Z' },
    ];
    expect(pickEntitledRow(rows, now).row).toBe(rows[1]);
    expect(pickEntitledRow([rows[0]], now).entitlement.entitled).toBe(false);
  });
});

describe('webhook/verify ordering race (Hank)', () => {
  // Minimal model of the row transitions both handlers perform on the reserved row.
  type Row = { id: string; user_id: string; status: string; razorpay_subscription_id: string | null; razorpay_payment_id: string | null };
  const reserved = (): Row => ({ id: 'p1', user_id: ME, status: 'pending', razorpay_subscription_id: 'sub_1', razorpay_payment_id: null });
  const cancelled: string[] = [];
  const webhookActivate = (row: Row) => {
    if (orphanAction(row, true, false) !== 'none') { cancelled.push(row.razorpay_subscription_id!); return; }
    row.status = 'active';
  };
  const verify = (row: Row, paymentId: string) => {
    const d = verifyDecision(ME, 'sub_1', row);
    if (d === 'activate') { row.status = 'active'; row.razorpay_payment_id = paymentId; return 'ok'; }
    if (d === 'idempotent') { row.razorpay_payment_id ??= paymentId; return 'ok'; }
    cancelled.push('sub_1'); return '409';
  };
  it('webhook first, then verify: idempotent success, payment id filled, never cancelled', () => {
    cancelled.length = 0;
    const row = reserved();
    webhookActivate(row);
    expect(row.status).toBe('active');
    expect(verify(row, 'pay_1')).toBe('ok');
    expect(row.razorpay_payment_id).toBe('pay_1');
    expect(cancelled).toEqual([]);
  });
  it('verify first, then webhook: webhook updates the active row, never cancels', () => {
    cancelled.length = 0;
    const row = reserved();
    expect(verify(row, 'pay_1')).toBe('ok');
    webhookActivate(row);
    expect(row.status).toBe('active');
    expect(cancelled).toEqual([]);
  });
  it('verify twice (replay) stays idempotent', () => {
    cancelled.length = 0;
    const row = reserved();
    verify(row, 'pay_1');
    expect(verify(row, 'pay_1')).toBe('ok');
    expect(cancelled).toEqual([]);
  });
  it('verifyDecision rejects expired rows, other users and other subs', () => {
    expect(verifyDecision(ME, 'sub_1', { ...reserved(), status: 'expired' })).toBe('reject');
    expect(verifyDecision(ME, 'sub_1', { ...reserved(), user_id: OTHER, status: 'active' })).toBe('reject');
    expect(verifyDecision(ME, 'sub_2', { ...reserved(), status: 'active' })).toBe('reject');
    expect(verifyDecision(ME, 'sub_1', null)).toBe('reject');
    expect(verifyDecision(ME, 'sub_1', { ...reserved(), status: 'authenticated' })).toBe('idempotent');
    // Hank follow-up 1: card-retry states are the user's own live sub -> idempotent, never cancelled
    expect(verifyDecision(ME, 'sub_1', { ...reserved(), status: 'paused' })).toBe('idempotent');
    expect(verifyDecision(ME, 'sub_1', { ...reserved(), status: 'halted' })).toBe('idempotent');
    expect(verifyDecision(OTHER, 'sub_1', { ...reserved(), status: 'paused' })).toBe('reject');
  });
});

describe('orphan rows do not stack (Retest 4 nit)', () => {
  it('pickSubscriptionRow prefers the real row over audit orphans', () => {
    const real = { id: 'r', status: 'active' }, o1 = { id: 'o1', status: 'orphan' }, o2 = { id: 'o2', status: 'orphan' };
    expect(pickSubscriptionRow([o1, real, o2])).toBe(real);
    expect(pickSubscriptionRow([o1, o2])).toBe(o1);
    expect(pickSubscriptionRow([])).toBeNull();
    expect(pickSubscriptionRow(null)).toBeNull();
  });
  it('verify on a sub that only has orphan rows rejects (cancel/refund path), never activates', () => {
    expect(verifyDecision(ME, 'sub_1', { user_id: ME, status: 'orphan', razorpay_subscription_id: 'sub_1' })).toBe('reject');
  });
});

describe('portal cancel message (Retest 4 nit)', () => {
  it('trial -> immediate; paid -> end of cycle with Sydney date', () => {
    expect(cancelMessage(planCancel({ paid_count: 0 } as any))).toMatch(/cancelled immediately/);
    const m = cancelMessage(planCancel({ paid_count: 2, current_end: Date.parse('2026-11-13T23:00:00Z') / 1000 } as any));
    expect(m).toMatch(/end of the billing cycle/); expect(m).toMatch(/14 November 2026/);
  });
});
