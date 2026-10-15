import { CHARGE_HOUR_IST, renewalDate, billingDate, billingLocalToUtc } from "./billing-dates.ts";

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

/** User-facing result of planCancel (Retest 4 nit: immediate vs end-of-cycle must be stated correctly). */
export function cancelMessage(plan: CancelPlan): string {
  if (plan.inTrial) return 'Subscription cancelled immediately. You will not be charged.';
  const d = plan.accessEndsAt.toLocaleDateString('en-AU', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
  return `Subscription will be cancelled at the end of the billing cycle. You keep access until ${d}.`;
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

export function formatBillingDate(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function trialReminderText(trialEnd: Date, amount: number): string {
  return `Your Zyntra free trial ends on ${formatBillingDate(trialEnd)}. If you don't cancel, we'll charge A$${amount} on that date. Cancel anytime in Settings > Billing.`;
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
  tier?: string | null;
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
  // No dates: FAIL CLOSED, except the explicit legacy one-time 'lifetime' tier (no new code path sells it).
  // Subscription rows get current_period_end backfilled from Razorpay by check-subscription; see
  // migration 20261014045000 for the backfill/audit query.
  if (end === null) {
    return row.tier === 'lifetime'
      ? { entitled: true, endsAt: null, reason: 'legacy_lifetime' }
      : { entitled: false, endsAt: null, reason: 'no_period_recorded' };
  }
  if (row.cancel_at_period_end) {
    return t < end ? { entitled: true, endsAt: new Date(end).toISOString(), reason: 'cancelled_until_period_end' } : { entitled: false, endsAt: new Date(end).toISOString(), reason: 'cancelled_expired' };
  }
  if (t < end) return { entitled: true, endsAt: new Date(end).toISOString(), reason: trialEnd !== null && t < trialEnd ? 'trial' : 'paid' };
  if (t < end + RENEWAL_GRACE_HOURS * 3600_000) return { entitled: true, endsAt: new Date(end).toISOString(), reason: 'renewal_grace' };
  return { entitled: false, endsAt: new Date(end).toISOString(), reason: 'period_expired' };
}

// ---- Checkout eligibility (Gus L2 / race) ----
export const PENDING_TTL_MS = 60 * 60 * 1000; // abandoned checkout rows expire after 1h
// paused/halted = card failed, Razorpay still retrying: still open (N2), blocks a parallel resubscribe.
export const OPEN_STATUSES = ['pending', 'active', 'authenticated', 'paused', 'halted'] as const;

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
  // Any row that reached Razorpay (has a subscription id), in ANY status incl. expired, uses up the trial (N1).
  const hadTrial = rows.some((r) => !!r.trial_end_at || !!r.razorpay_subscription_id);
  return { ok: true, trial: !hadTrial };
}

/** Verify/webhook: an authorized subscription is accepted only against the caller's own pending row for it. */
export function matchesPendingRow(userId: string, subscriptionId: string, row: { user_id: string; status: string; razorpay_subscription_id: string | null } | null): boolean {
  return !!row && row.user_id === userId && row.status === 'pending' && row.razorpay_subscription_id === subscriptionId;
}

// ---- Orphan / mismatched subscriptions (Hank B1) ----
export const RAZORPAY_TERMINAL = ['cancelled', 'completed', 'expired'] as const;
export const RAZORPAY_LIVE = ['created', 'authenticated', 'active', 'pending', 'halted'] as const;

export type OrphanAction = 'none' | 'cancel' | 'cancel_and_refund';
/**
 * What to do with a Razorpay subscription event that does not map to a valid reserved row.
 * - no row, or row expired/cancelled/superseded/orphan: cancel the subscription NOW at Razorpay;
 *   if the event carries a captured payment, also flag it for manual refund.
 * - valid row (pending/active/authenticated/paused): none.
 */
export function orphanAction(row: { status: string } | null, eventGrantsAccess: boolean, hasCapture: boolean): OrphanAction {
  const invalid = !row || ['expired', 'cancelled', 'superseded', 'orphan'].includes(row.status);
  if (!invalid || !eventGrantsAccess) return 'none';
  return hasCapture ? 'cancel_and_refund' : 'cancel';
}

/** Which of a user's pending rows may be expired: only those with NO Razorpay subscription id. */
export function pendingRowExpirable(row: { status: string; razorpay_subscription_id: string | null; created_at: string }, now: Date = new Date()): boolean {
  return row.status === 'pending' && !row.razorpay_subscription_id && Date.parse(row.created_at) < now.getTime() - PENDING_TTL_MS;
}

/**
 * A stale pending row WITH a subscription id is resolved by asking Razorpay:
 * terminal -> expire row; 'created' (never authorised) -> cancel at Razorpay then expire row;
 * authenticated/active/etc. -> keep (the user has a live subscription; webhook/verify will promote it).
 */
export function resolveStalePending(rzStatus: string | null): 'expire' | 'cancel_then_expire' | 'keep' {
  if (rzStatus && (RAZORPAY_TERMINAL as readonly string[]).includes(rzStatus)) return 'expire';
  if (rzStatus === 'created') return 'cancel_then_expire';
  return 'keep';
}

/** check-subscription / hasPaidAccess: the same row selection — any entitled row wins. */
export function pickEntitledRow<T extends EntitlementRow>(rows: T[], now: Date = new Date()): { row: T | null; entitlement: Entitlement } {
  for (const r of rows) {
    const e = entitlementFromRow(r, now);
    if (e.entitled) return { row: r, entitlement: e };
  }
  return { row: rows[0] ?? null, entitlement: entitlementFromRow(rows[0] ?? null, now) };
}

/** Crash-safe reconcile (N1): a pending row whose subscription id was never saved can be matched by the
 *  pending_payment_id that create-razorpay-order put in the subscription notes. */
export function reconcilesPendingRow(userId: string, notes: { user_id?: string; pending_payment_id?: string } | null | undefined,
  row: { id: string; user_id: string; status: string; razorpay_subscription_id: string | null } | null): boolean {
  return !!row && !!notes && notes.user_id === userId && notes.pending_payment_id === row.id
    && row.user_id === userId && row.status === 'pending' && !row.razorpay_subscription_id;
}

/** No-trial resubscribe verified before Razorpay reports current_end: provisional paid-through = now + interval. */
export function provisionalPeriodEnd(interval: 'monthly' | 'quarterly', now: Date = new Date()): string {
  // Same anniversary/clamp rule as everything else (31 Jan -> 28/29 Feb, never 3 Mar): IST date anchor,
  // renewalDate(+1 period), at the standard IST charge hour.
  return billingLocalToUtc(renewalDate(billingDate(now), 1, interval), CHARGE_HOUR_IST, 1).toISOString();
}

/**
 * verify-razorpay-payment decision for a subscription (Hank: webhook-first race).
 * - caller's own pending row for this sub            -> 'activate'
 * - caller's own row ALREADY active/authenticated/paused/halted
 *   for this sub (webhook got there first)           -> 'idempotent' (success; fill payment id if missing; NEVER cancel)
 * - anything else (no row / expired / other user)    -> 'reject' (cancel at provider + refund flag)
 */
export function verifyDecision(userId: string, subscriptionId: string,
  row: { user_id: string; status: string; razorpay_subscription_id: string | null } | null): 'activate' | 'idempotent' | 'reject' {
  if (matchesPendingRow(userId, subscriptionId, row)) return 'activate';
  if (row && row.user_id === userId && row.razorpay_subscription_id === subscriptionId && ['active', 'authenticated', 'paused', 'halted'].includes(row.status)) return 'idempotent';
  return 'reject';
}

/** Several rows may share a subscription id (audit 'orphan' rows); always prefer the real (non-orphan) row. */
export function pickSubscriptionRow<T extends { status: string }>(rows: T[] | null | undefined): T | null {
  if (!rows || rows.length === 0) return null;
  return rows.find((r) => r.status !== 'orphan') ?? rows[0];
}

/** Razorpay statuses after which a subscription can never charge again: a failed cancel on these IS done. */
export const RAZORPAY_TERMINAL_STATUSES = ['cancelled', 'completed', 'expired'] as const;
export function cancelAlreadyDone(status: string | null | undefined): boolean {
  return !!status && (RAZORPAY_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Postgres unique_violation (23505) of ANY constraint. Prefer isExpectedUniqueViolation for no-op decisions. */
export function isUniqueViolation(e: { code?: string } | null | undefined): boolean {
  return e?.code === '23505';
}

/** Unique indexes whose 23505 means "already recorded" (idempotent replay), never a real failure. */
export const RAZORPAY_PAYMENT_ID_KEY = 'payments_razorpay_payment_id_key';
export const REFUND_PAYMENT_ID_KEY = 'payments_refund_payment_id_key';
export const PAYPAL_ORDER_ID_KEY = 'idx_payments_paypal_order_id';
export const PAYPAL_SUBSCRIPTION_ID_KEY = 'idx_payments_paypal_subscription_id';

/** Name of the violated constraint from a PostgREST/pg error ("... violates unique constraint \"x\""). */
export function violatedConstraint(e: { code?: string; message?: string; details?: string; constraint?: string } | null | undefined): string | null {
  if (!e || e.code !== '23505') return null;
  if (e.constraint) return e.constraint;
  const m = /unique constraint "([^"]+)"/.exec(`${e.message ?? ''} ${e.details ?? ''}`);
  return m ? m[1] : null;
}

/** Hank: 23505 is a no-op ONLY when the violated constraint is one of the expected unique indexes. */
export function isExpectedUniqueViolation(
  e: { code?: string; message?: string; details?: string; constraint?: string } | null | undefined,
  expected: readonly string[],
): boolean {
  const c = violatedConstraint(e);
  return !!c && expected.includes(c);
}

/** V2 port: the payments update to write from a Razorpay subscription for a pending/authenticated row, or null. */
export function razorpaySyncUpdate(sub: { status?: string; start_at?: unknown; current_end?: unknown; charge_at?: unknown; [k: string]: unknown }):
  { status: string; trial_end_at?: string; current_period_end?: string } | null {
  const iso = (v: unknown) => (typeof v === 'number' ? new Date(v * 1000).toISOString() : undefined);
  if (sub.status === 'active') {
    const end = iso(sub.current_end) ?? iso(sub.charge_at);
    return end ? { status: 'active', current_period_end: end } : null; // no date -> do not write an undated active row
  }
  if (sub.status === 'authenticated') {
    // Trial: authenticated with a future start_at; entitled until trial end.
    const trial = iso(sub.start_at) ?? iso(sub.charge_at);
    return trial ? { status: 'active', trial_end_at: trial } : null;
  }
  if (sub.status && (RAZORPAY_TERMINAL_STATUSES as readonly string[]).includes(sub.status)) return { status: 'cancelled' };
  return null;
}

/** Hank B3: a Razorpay sub may only update a row when it IS that row's sub and was created for this caller
 *  (same id + notes.user_id checks as authorizeCancel). */
export function syncOwnershipOk(
  callerId: string,
  row: { user_id?: string | null; razorpay_subscription_id?: string | null } | null,
  sub: { id?: unknown; notes?: unknown } | null,
): boolean {
  if (!row || !row.razorpay_subscription_id || row.user_id !== callerId || !sub) return false;
  const notes = (sub.notes ?? {}) as { user_id?: unknown };
  return sub.id === row.razorpay_subscription_id && notes.user_id === callerId;
}
