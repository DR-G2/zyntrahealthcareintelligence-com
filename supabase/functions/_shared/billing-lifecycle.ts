// Pure billing-lifecycle logic shared by edge functions (no Deno APIs, so it is unit-tested with vitest).

export interface PaymentRow {
  id: string;
  user_id: string;
  razorpay_subscription_id: string | null;
  status: string;
  tier: string;
  amount?: number | null;
  trial_end_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  trial_reminder_sent_at?: string | null;
}

/** Subset of a Razorpay subscription entity. Timestamps are unix seconds. */
export interface RazorpaySub {
  id: string;
  status: string; // created | authenticated | active | pending | halted | cancelled | completed | expired
  start_at?: number | null; // first charge = trial end
  current_end?: number | null;
  paid_count?: number | null;
  notes?: { user_id?: string } | null;
}

export type AuthResult = { ok: true } | { ok: false; status: 403 | 404 | 409; error: string };

/** The caller may cancel only a subscription recorded against their own user id AND tagged with it at Razorpay. */
export function authorizeCancel(callerId: string, row: PaymentRow | null, sub: RazorpaySub | null): AuthResult {
  if (!row || !row.razorpay_subscription_id) return { ok: false, status: 404, error: 'No subscription found' };
  if (row.user_id !== callerId) return { ok: false, status: 403, error: 'Subscription does not belong to this account' };
  if (!sub || sub.id !== row.razorpay_subscription_id) return { ok: false, status: 404, error: 'Subscription not found at provider' };
  if (sub.notes?.user_id !== callerId) return { ok: false, status: 403, error: 'Subscription does not belong to this account' };
  if (row.cancel_at_period_end || ['cancelled', 'completed', 'expired'].includes(sub.status)) {
    return { ok: false, status: 409, error: 'Subscription is already cancelled' };
  }
  return { ok: true };
}

export interface CancelPlan {
  inTrial: boolean;
  /** Razorpay cancel flag: 0 = now (trial, nothing charged), 1 = at end of current paid period. */
  cancelAtCycleEnd: 0 | 1;
  accessEndsAt: Date;
}

/**
 * No successful charge yet (in trial, OR start_at has passed but the first charge is still pending/retrying):
 * cancel NOW so no A$39/A$99 can be collected afterwards. Otherwise keep access to period end.
 */
export function planCancel(sub: RazorpaySub, now: Date = new Date()): CancelPlan {
  const nowSec = Math.floor(now.getTime() / 1000);
  // L1: paid_count === 0 (trial OR first charge still retrying) => ALWAYS immediate, never cycle-end.
  const inTrial = !(typeof sub.paid_count === 'number' && sub.paid_count > 0);
  if (inTrial) return { inTrial: true, cancelAtCycleEnd: 0, accessEndsAt: now };
  return { inTrial: false, cancelAtCycleEnd: 1, accessEndsAt: new Date((sub.current_end ?? nowSec) * 1000) };
}

/** Reminder window: trial ends 48–72h from now, so the email always lands >= 2 days before. Run hourly. */
export const REMINDER_MIN_HOURS = 48;
export const REMINDER_MAX_HOURS = 72;

export function selectTrialReminders(rows: PaymentRow[], now: Date = new Date()): PaymentRow[] {
  const lo = now.getTime() + REMINDER_MIN_HOURS * 3600_000;
  const hi = now.getTime() + REMINDER_MAX_HOURS * 3600_000;
  return rows.filter((r) => {
    if (!r.trial_end_at || r.trial_reminder_sent_at || r.cancel_at_period_end) return false;
    if (r.status !== 'active' || !r.razorpay_subscription_id) return false;
    const t = new Date(r.trial_end_at).getTime();
    return t >= lo && t < hi;
  });
}

export function formatSydneyDate(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });
}

export function trialReminderText(trialEnd: Date, amount: number): string {
  return `Your Zyntra free trial ends on ${formatSydneyDate(trialEnd)}. If you don't cancel, we'll charge A$${amount} on that date. Cancel anytime in Settings > Billing.`;
}

// ---- Email provider interface (Resend implementation lives in trial-reminder-email) ----
export interface EmailMessage { to: string; subject: string; text: string; html: string }
export interface EmailProvider { send(msg: EmailMessage): Promise<void> }

/** Store abstraction so the idempotent send loop is testable without a database. */
export interface ReminderStore {
  /** Atomically set trial_reminder_sent_at where it is NULL; true if this caller won the claim. */
  claim(id: string, at: Date): Promise<boolean>;
  release(id: string): Promise<void>;
  emailFor(userId: string): Promise<string | null>;
}

export async function sendTrialReminders(rows: PaymentRow[], store: ReminderStore, provider: EmailProvider, now: Date = new Date()) {
  let sent = 0, failed = 0, skipped = 0;
  for (const row of selectTrialReminders(rows, now)) {
    if (!(await store.claim(row.id, now))) { skipped++; continue; }
    try {
      const to = await store.emailFor(row.user_id);
      if (!to) throw new Error('no email');
      const text = trialReminderText(new Date(row.trial_end_at!), row.amount ?? 39);
      const html = `<p>${text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))}</p>`;
      await provider.send({ to, subject: 'Your Zyntra free trial ends soon', text, html });
      sent++;
    } catch {
      await store.release(row.id); // retry on next hourly run
      failed++;
    }
  }
  return { sent, failed, skipped };
}

// ---- Server-side entitlement (Hank: expiry must be enforced from stored dates) ----
/** Grace after current_period_end for a renewal webhook to arrive before access lapses (not cancelled subs only). */
export const RENEWAL_GRACE_HOURS = 48;

export interface EntitlementRow {
  status: string;
  trial_end_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}
export interface Entitlement { entitled: boolean; endsAt: string | null; reason: string }

/** Decides access from stored dates only. Never fails open: missing provider data cannot extend access. */
export function entitlementFromRow(row: EntitlementRow | null, now: Date = new Date()): Entitlement {
  if (!row || row.status !== 'active') return { entitled: false, endsAt: null, reason: 'no_active_payment' };
  const t = now.getTime();
  const periodEnd = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  const trialEnd = row.trial_end_at ? new Date(row.trial_end_at).getTime() : null;
  const end = periodEnd ?? trialEnd;
  // Rows created before date columns existed: status alone decides (same as before this change).
  // check-subscription backfills current_period_end from Razorpay on the next check.
  if (end === null) return { entitled: true, endsAt: null, reason: 'legacy_no_dates' };
  if (row.cancel_at_period_end) {
    return t < end ? { entitled: true, endsAt: new Date(end).toISOString(), reason: 'cancelled_until_period_end' } : { entitled: false, endsAt: new Date(end).toISOString(), reason: 'cancelled_expired' };
  }
  if (t < end) return { entitled: true, endsAt: new Date(end).toISOString(), reason: trialEnd !== null && t < trialEnd ? 'trial' : 'paid' };
  if (t < end + RENEWAL_GRACE_HOURS * 3600_000) return { entitled: true, endsAt: new Date(end).toISOString(), reason: 'renewal_grace' };
  return { entitled: false, endsAt: new Date(end).toISOString(), reason: 'period_expired' };
}

// ---- Checkout eligibility (Gus L2 / race) ----
export const PENDING_TTL_MS = 60 * 60 * 1000; // abandoned checkout rows expire after 1h
export const OPEN_STATUSES = ['pending', 'active', 'authenticated'] as const;

export interface HistoryRow { status: string; trial_end_at?: string | null; razorpay_subscription_id?: string | null }
export type CheckoutDecision = { ok: true; trial: boolean } | { ok: false; error: string };

/**
 * - Any open row (pending / active / authenticated) -> 409.
 * - Never had a trial/subscription -> new customer with 7-day trial + A$1 card check.
 * - Previously trialled or subscribed (now cancelled/expired/lapsed) -> resubscribe WITHOUT a trial.
 * Callers must expire stale pending rows first.
 */
export function checkoutDecision(rows: HistoryRow[]): CheckoutDecision {
  if (rows.some((r) => (OPEN_STATUSES as readonly string[]).includes(r.status))) {
    return { ok: false, error: rows.some((r) => r.status === 'pending')
      ? 'A checkout or subscription is already in progress for this account.'
      : 'You already have an active subscription.' };
  }
  // 'expired' = abandoned checkout (pending row timed out, never authorized): does not use up the trial.
  const hadTrial = rows.some((r) => !!r.trial_end_at || (!!r.razorpay_subscription_id && r.status !== 'expired'));
  return { ok: true, trial: !hadTrial };
}

/** Verify/webhook: an authorized subscription is accepted only against the caller's own pending row for it. */
export function matchesPendingRow(userId: string, subscriptionId: string, row: { user_id: string; status: string; razorpay_subscription_id: string | null } | null): boolean {
  return !!row && row.user_id === userId && row.status === 'pending' && row.razorpay_subscription_id === subscriptionId;
}
