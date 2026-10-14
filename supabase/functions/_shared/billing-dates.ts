// SINGLE SOURCE OF TRUTH for trial / billing dates. Imported by the web client (src/lib/billing.ts)
// and by edge functions (create-razorpay-order), so checkout copy and the real first charge always agree.
// Pure TS, no imports, no Deno/browser APIs beyond Intl.
export const BILLING_TIMEZONE = 'Australia/Sydney';
export const TRIAL_DAYS = 7;
/** Sydney local hour at which the first charge (subscription start_at) is scheduled on the trial-end date. */
export const CHARGE_HOUR_SYDNEY = 10;

export type PlanInterval = 'monthly' | 'quarterly';
export const PLAN_PRICES: Record<PlanInterval, { price: number; months: number }> = {
  monthly: { price: 39, months: 1 },
  quarterly: { price: 99, months: 3 },
};

export interface YMD { y: number; m: number; d: number } // m: 1-12

/** Calendar date of an instant in Sydney time. */
export function sydneyDate(instant: Date): YMD {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BILLING_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function addDays(a: YMD, n: number): YMD {
  const t = new Date(Date.UTC(a.y, a.m - 1, a.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
export function addMonths(a: YMD, n: number): { y: number; m: number } {
  const idx = a.y * 12 + (a.m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** Offset (ms) of Sydney from UTC at a given instant. */
function sydneyOffsetMs(instant: Date): number {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: BILLING_TIMEZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(instant);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(instant.getTime() / 1000) * 1000;
}

/** UTC instant for a Sydney local wall-clock time (DST-aware). */
export function sydneyLocalToUtc(a: YMD, hour: number): Date {
  const naive = Date.UTC(a.y, a.m - 1, a.d, hour);
  let t = naive - sydneyOffsetMs(new Date(naive));
  t = naive - sydneyOffsetMs(new Date(t));
  return new Date(t);
}

export function trialEndDate(signup: Date = new Date()): YMD {
  return addDays(sydneyDate(signup), TRIAL_DAYS);
}

/** Unix seconds for Razorpay subscription start_at: trial-end Sydney date at CHARGE_HOUR_SYDNEY local. */
export function firstChargeUnix(signup: Date = new Date()): number {
  return Math.floor(sydneyLocalToUtc(trialEndDate(signup), CHARGE_HOUR_SYDNEY).getTime() / 1000);
}

/** End (inclusive Sydney date) of the first paid period, anniversary billing. */
export function firstPeriodEnd(interval: PlanInterval, signup: Date = new Date()): YMD {
  return periodEnd(trialEndDate(signup), 0, interval);
}

/**
 * Renewal date n (n=0 is the first charge = trial end). Always computed from the ORIGINAL anchor day,
 * so a clamped month does not drift: 31 Jan -> 28/29 Feb -> 31 Mar -> 30 Apr -> 31 May.
 */
export function renewalDate(anchor: YMD, n: number, interval: PlanInterval = 'monthly'): YMD {
  const em = addMonths(anchor, n * PLAN_PRICES[interval].months);
  return { ...em, d: Math.min(anchor.d, daysInMonth(em.y, em.m)) };
}

/** Inclusive end of paid period n: the day before renewal n+1. */
export function periodEnd(anchor: YMD, n: number, interval: PlanInterval = 'monthly'): YMD {
  return addDays(renewalDate(anchor, n + 1, interval), -1);
}

export function ordinal(d: number): string {
  const s = d % 100 >= 11 && d % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[d % 10] ?? 'th';
  return `${d}${s}`;
}
