import { describe, it, expect, vi } from 'vitest';
import {
  authorizeCancel, planCancel, selectTrialReminders, sendTrialReminders, trialReminderText,
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
