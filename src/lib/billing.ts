// Client billing helper + checkout copy. Dates come from the shared module that the
// create-razorpay-order edge function also uses, so copy and actual charge date always match.
// Confirmed model: ANNIVERSARY billing, Australia/Sydney, no pro-rating.
import {
  PLAN_PRICES, TRIAL_DAYS, BILLING_TIMEZONE, firstPeriodEnd, trialEndDate, ordinal, renewalDate, periodEnd,
  type PlanInterval, type YMD,
} from '../../supabase/functions/_shared/billing-dates';

export { PLAN_PRICES, TRIAL_DAYS, BILLING_TIMEZONE, ordinal, renewalDate, periodEnd, type PlanInterval, type YMD };
export type BillingModel = 'anniversary';
export const BILLING_MODEL: BillingModel = 'anniversary';
export const CURRENCY = 'AUD';
export const CARD_CHECK_AMOUNT = 1; // A$1 card check
export const MONTHLY_PRICE = 39;

export interface BillingSchedule { model: BillingModel; trialEnd: YMD; periodEnd: YMD; firstCharge: number }

export function computeSchedule(interval: PlanInterval, signup: Date = new Date()): BillingSchedule {
  return { model: BILLING_MODEL, trialEnd: trialEndDate(signup), periodEnd: firstPeriodEnd(interval, signup), firstCharge: PLAN_PRICES[interval].price };
}

export function formatYMD(a: YMD): string {
  return new Date(Date.UTC(a.y, a.m - 1, a.d)).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ---- Checkout copy (legal-approved; do not edit wording without legal review) ----
export function checkoutSummary(interval: PlanInterval, signup: Date = new Date()): string {
  const te = trialEndDate(signup);
  const d = formatYMD(te);
  if (interval === 'quarterly') {
    return `A$1 card check today. Your 7-day free trial ends on ${d}. If you don't cancel before then, we'll charge A$99 on ${d}, then A$99 every 3 months until you cancel.`;
  }
  // Days 29–31 only: name the anniversary day and the short-month clamp (Saul rewrite).
  // renewalDate() restores the original day after a clamped month, so this copy is accurate.
  if (te.d >= 29) {
    const od = ordinal(te.d);
    return `A$1 card check today. Your 7-day free trial ends on ${d}. If you don't cancel before then, we'll charge A$39 on ${d}, then A$39 every month on the ${od} (or the last day of the month, in months without a ${od}) until you cancel.`;
  }
  return `A$1 card check today. Your 7-day free trial ends on ${d}. If you don't cancel before then, we'll charge A$39 on ${d}, then A$39 every month on that date until you cancel.`;
}
export const COPY_CARD_CHECK = 'The A$1 card check confirms your card. It is not refunded if you cancel, except where required by law.';
export const COPY_CANCEL = "Cancel anytime in Settings > Billing. Cancel during your trial and you won't be charged A$39.";
/** Plan-aware variant (nit: 3-month plan charges A$99, not A$39). */
export function cancelCopy(interval: PlanInterval): string {
  return interval === 'quarterly'
    ? "Cancel anytime in Settings > Billing. Cancel during your trial and you won't be charged A$99."
    : COPY_CANCEL;
}
export const COPY_ACL = 'Nothing in these terms excludes, restricts or modifies any right or remedy you have under the Australian Consumer Law.';
