import { describe, it, expect, vi } from 'vitest';
import {
  authorizeCancel, planCancel, checkoutDecision, matchesPendingRow, selectTrialReminders, sendTrialReminders, trialReminderText,
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
    for (const status of ['pending', 'active', 'authenticated']) expect(checkoutDecision([{ status }]).ok).toBe(false);
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
    expect(checkoutDecision([{ status: 'expired', razorpay_subscription_id: 'sub_abandoned', trial_end_at: null }])).toEqual({ ok: true, trial: true });
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
