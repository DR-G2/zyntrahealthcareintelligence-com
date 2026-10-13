// Single source of truth for Zyntra billing-period logic and checkout copy.
// Confirmed: ANNIVERSARY billing. Each period is one full month (3-month plan: three full months)
// from the trial end date, renewing on that same day. Australia/Sydney. No pro-rating.
// Switch BILLING_MODEL here only; every date/copy consumer reads from this module.
export type BillingModel = 'anniversary';
export const BILLING_MODEL: BillingModel = 'anniversary';
export const BILLING_TIMEZONE = 'Australia/Sydney';
export const CURRENCY = 'AUD';
export const TRIAL_DAYS = 7;
export const CARD_CHECK_AMOUNT = 1; // A$1, non-refundable card check
export const MONTHLY_PRICE = 39;

export type PlanInterval = 'monthly' | 'quarterly';
export const PLAN_PRICES: Record<PlanInterval, { price: number; months: number; label: string }> = {
  monthly: { price: 39, months: 1, label: 'A$39/month' },
  quarterly: { price: 99, months: 3, label: 'A$99 for 3 months' },
};

interface YMD { y: number; m: number; d: number } // m: 1-12

/** Calendar date of an instant in Sydney time. */
export function sydneyDate(instant: Date): YMD {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BILLING_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function addDays(a: YMD, n: number): YMD {
  const t = new Date(Date.UTC(a.y, a.m - 1, a.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
function addMonths(a: YMD, n: number): { y: number; m: number } {
  const idx = a.y * 12 + (a.m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export interface BillingSchedule {
  model: BillingModel;
  trialEnd: YMD;      // first charge date (Sydney)
  periodEnd: YMD;     // last day of first paid period (inclusive, Sydney)
  firstCharge: number;
}

/** Trial end (= first charge date) and end of first paid period, anniversary billing, Sydney dates. */
export function computeSchedule(interval: PlanInterval, signup: Date = new Date()): BillingSchedule {
  const plan = PLAN_PRICES[interval];
  const trialEnd = addDays(sydneyDate(signup), TRIAL_DAYS);
  const em = addMonths(trialEnd, plan.months);
  // Renewal day clamps to month length (e.g. 31 Jan -> 28 Feb); period ends the day before renewal.
  const periodEnd = addDays({ ...em, d: Math.min(trialEnd.d, daysInMonth(em.y, em.m)) }, -1);
  return { model: BILLING_MODEL, trialEnd, periodEnd, firstCharge: plan.price };
}

export function formatYMD(a: YMD): string {
  return new Date(Date.UTC(a.y, a.m - 1, a.d)).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ---- Checkout copy (legal-approved; do not edit wording without legal review) ----
export function checkoutSummary(interval: PlanInterval, signup: Date = new Date()): string {
  const d = formatYMD(computeSchedule(interval, signup).trialEnd);
  return interval === 'monthly'
    ? `A$1 card check today. Your 7-day free trial ends on ${d}. If you don't cancel before then, we'll charge A$39 on ${d}, then A$39 every month on that date until you cancel.`
    : `A$1 card check today. Your 7-day free trial ends on ${d}. If you don't cancel before then, we'll charge A$99 on ${d}, then A$99 every 3 months until you cancel.`;
}
export const COPY_CARD_CHECK = 'The A$1 card check confirms your card. It is not refunded if you cancel, except where required by law.';
export const COPY_CANCEL = "Cancel anytime in Settings > Billing. Cancel during your trial and you won't be charged A$39.";
export const COPY_ACL = 'Nothing in these terms excludes, restricts or modifies any right or remedy you have under the Australian Consumer Law.';
