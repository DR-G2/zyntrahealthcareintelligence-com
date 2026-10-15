import { describe, it, expect } from 'vitest';
import { computeSchedule, checkoutSummary, cancelCopy, BILLING_MODEL, renewalDate, periodEnd, ordinal, resubscribeSummary, resubscribeRenewal, COPY_CANCEL_RESUBSCRIBE } from './billing';
import { firstChargeUnix, billingDate, trialEndDate } from '../../supabase/functions/_shared/billing-dates';

const signup = new Date('2026-10-12T23:00:00Z'); // 13 Oct 2026 10:00 IST (AEDT)

describe('billing schedule (anniversary)', () => {
  it('default model is anniversary', () => expect(BILLING_MODEL).toBe('anniversary'));
  it('monthly: trial ends +7 IST days; period one full month', () => {
    const s = computeSchedule('monthly', signup);
    expect(s.trialEnd).toEqual({ y: 2026, m: 10, d: 19 });
    expect(s.periodEnd).toEqual({ y: 2026, m: 11, d: 18 });
    expect(s.firstCharge).toBe(39);
  });
  it('3-month across year end', () => {
    const s = computeSchedule('quarterly', new Date('2026-11-29T01:00:00Z'));
    expect(s.trialEnd).toEqual({ y: 2026, m: 12, d: 5 });
    expect(s.periodEnd).toEqual({ y: 2027, m: 3, d: 4 });
    expect(s.firstCharge).toBe(99);
  });
  it('uses IST date, not UTC date', () => {
    expect(computeSchedule('monthly', new Date('2026-10-31T14:00:00Z')).trialEnd).toEqual({ y: 2026, m: 11, d: 6 });
  });
  it('monthly copy', () => {
    expect(checkoutSummary('monthly', signup)).toBe("A$1 card verification today. Your 7-calendar-day trial (signup date counts as day 1) ends on 19 October 2026. If you don't cancel before then, we'll charge A$39 on 19 October 2026, then A$39 every month on that date until you cancel.");
  });
  it('3-month copy', () => {
    expect(checkoutSummary('quarterly', signup)).toBe("A$1 card verification today. Your 7-calendar-day trial (signup date counts as day 1) ends on 19 October 2026. If you don't cancel before then, we'll charge A$99 on 19 October 2026, then A$99 every 3 months until you cancel.");
  });
  it('days 29/30/31 use the ordinal clamp line; 28 and earlier do not', () => {
    // signup 23:00Z = next day 10:00 IST; trial end = that IST date + 7
    const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d - 7, 18, 30)); // IST date d-7
    expect(checkoutSummary('monthly', at(2027, 1, 31))).toBe("A$1 card verification today. Your 7-calendar-day trial (signup date counts as day 1) ends on 31 January 2027. If you don't cancel before then, we'll charge A$39 on 31 January 2027, then A$39 every month on the 31st (or the last day of the month, in months without a 31st) until you cancel.");
    expect(checkoutSummary('monthly', at(2027, 1, 30))).toContain('every month on the 30th (or the last day of the month, in months without a 30th) until you cancel.');
    expect(checkoutSummary('monthly', at(2027, 1, 29))).toContain('every month on the 29th (or the last day of the month, in months without a 29th) until you cancel.');
    const d28 = checkoutSummary('monthly', at(2027, 1, 28));
    expect(d28).toContain('then A$39 every month on that date until you cancel.');
    expect(d28).not.toContain('last day of the month');
    expect(checkoutSummary('quarterly', at(2027, 1, 31))).not.toContain('last day of the month');
    expect(checkoutSummary('monthly', at(2027, 1, 31))).not.toContain('without the 31st');
  });
  it('clamp restores the anniversary day (no drift)', () => {
    const jan31 = { y: 2027, m: 1, d: 31 };
    expect(renewalDate(jan31, 1)).toEqual({ y: 2027, m: 2, d: 28 });
    expect(renewalDate(jan31, 2)).toEqual({ y: 2027, m: 3, d: 31 });
    expect(renewalDate(jan31, 3)).toEqual({ y: 2027, m: 4, d: 30 });
    expect(renewalDate(jan31, 4)).toEqual({ y: 2027, m: 5, d: 31 });
    expect(periodEnd(jan31, 0)).toEqual({ y: 2027, m: 2, d: 27 });
    expect(periodEnd(jan31, 1)).toEqual({ y: 2027, m: 3, d: 30 });
    const jan30 = { y: 2027, m: 1, d: 30 };
    expect(renewalDate(jan30, 1)).toEqual({ y: 2027, m: 2, d: 28 });
    expect(renewalDate(jan30, 2)).toEqual({ y: 2027, m: 3, d: 30 });
    const leap = { y: 2028, m: 1, d: 31 };
    expect(renewalDate(leap, 1)).toEqual({ y: 2028, m: 2, d: 29 });
    expect(renewalDate(leap, 2)).toEqual({ y: 2028, m: 3, d: 31 });
    expect(renewalDate({ y: 2027, m: 11, d: 30 }, 1, 'quarterly')).toEqual({ y: 2028, m: 2, d: 29 });
    expect(renewalDate({ y: 2027, m: 11, d: 30 }, 2, 'quarterly')).toEqual({ y: 2028, m: 5, d: 30 });
  });
  it('ordinal', () => expect([1, 2, 3, 11, 21, 29, 30, 31].map(ordinal)).toEqual(['1st', '2nd', '3rd', '11th', '21st', '29th', '30th', '31st']));
  it('cancel copy is plan-aware', () => {
    expect(cancelCopy('quarterly')).toContain('A$99');
    expect(cancelCopy('monthly')).toContain('A$39');
  });
});

describe('B2: server start_at equals the IST trial-end date shown in copy (DST sweep)', () => {
  it('every hour of 2026 and 2027: start_at falls on the copy date at 10:00 IST', () => {
    let mismatches = 0;
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 3600_000) {
      const signupAt = new Date(t);
      const charge = new Date(firstChargeUnix(signupAt) * 1000);
      const shown = trialEndDate(signupAt);
      const charged = billingDate(charge);
      const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(charge));
      if (charged.y !== shown.y || charged.m !== shown.m || charged.d !== shown.d || hour !== 0 || Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', minute: 'numeric' }).format(charge)) !== 1) mismatches++;
    }
    expect(mismatches).toBe(0);
  }, 60_000);
});

describe('resubscribe copy (Saul rewrite)', () => {
  const d15 = new Date('2027-03-15T00:00:00Z'); // 15 Mar 2027 05:30 IST
  const d31 = new Date('2027-01-31T00:00:00Z'); // 31 Jan 2027 05:30 IST
  it('monthly day 15', () => expect(resubscribeSummary('monthly', d15)).toBe("Welcome back. We'll charge A$39 today (15 March 2027), then A$39 every month on the 15th until you cancel. Free trials are for first-time subscribers only."));
  it('quarterly day 15', () => expect(resubscribeSummary('quarterly', d15)).toBe("Welcome back. We'll charge A$99 today (15 March 2027), then A$99 every 3 months on the 15th until you cancel. Free trials are for first-time subscribers only."));
  it('monthly day 31', () => expect(resubscribeSummary('monthly', d31)).toBe("Welcome back. We'll charge A$39 today (31 January 2027), then A$39 every month on the 31st (or the last day of the month, in months without a 31st) until you cancel. Free trials are for first-time subscribers only."));
  it('quarterly day 31', () => expect(resubscribeSummary('quarterly', d31)).toBe("Welcome back. We'll charge A$99 today (31 January 2027), then A$99 every 3 months on the 31st (or the last day of the month, in months without a 31st) until you cancel. Free trials are for first-time subscribers only."));
  it('uses IST date (UTC still previous day)', () => expect(resubscribeSummary('monthly', new Date('2027-03-14T19:00:00Z'))).toContain('today (15 March 2027)'));
  it('renewals anchor on today IST with no drift', () => {
    expect([1, 2, 3].map((n) => resubscribeRenewal('monthly', n, d31))).toEqual([{ y: 2027, m: 2, d: 28 }, { y: 2027, m: 3, d: 31 }, { y: 2027, m: 4, d: 30 }]);
    expect([1, 2].map((n) => resubscribeRenewal('quarterly', n, d31))).toEqual([{ y: 2027, m: 4, d: 30 }, { y: 2027, m: 7, d: 31 }]);
    expect(resubscribeRenewal('monthly', 1, d15)).toEqual({ y: 2027, m: 4, d: 15 });
    expect(resubscribeRenewal('quarterly', 1, d15)).toEqual({ y: 2027, m: 6, d: 15 });
  });
  it('resubscribe cancel copy has no trial sentence', () => {
    expect(COPY_CANCEL_RESUBSCRIBE).toBe('Cancel anytime in Settings > Billing.');
  });
});
