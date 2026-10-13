import { describe, it, expect } from 'vitest';
import { computeSchedule, checkoutSummary, cancelCopy, BILLING_MODEL } from './billing';
import { firstChargeUnix, sydneyDate, trialEndDate } from '../../supabase/functions/_shared/billing-dates';

const signup = new Date('2026-10-12T23:00:00Z'); // 13 Oct 2026 10:00 Sydney (AEDT)

describe('billing schedule (anniversary)', () => {
  it('default model is anniversary', () => expect(BILLING_MODEL).toBe('anniversary'));
  it('monthly: trial ends +7 Sydney days; period one full month', () => {
    const s = computeSchedule('monthly', signup);
    expect(s.trialEnd).toEqual({ y: 2026, m: 10, d: 20 });
    expect(s.periodEnd).toEqual({ y: 2026, m: 11, d: 19 });
    expect(s.firstCharge).toBe(39);
  });
  it('3-month across year end', () => {
    const s = computeSchedule('quarterly', new Date('2026-11-29T01:00:00Z'));
    expect(s.trialEnd).toEqual({ y: 2026, m: 12, d: 6 });
    expect(s.periodEnd).toEqual({ y: 2027, m: 3, d: 5 });
    expect(s.firstCharge).toBe(99);
  });
  it('uses Sydney date, not UTC date', () => {
    expect(computeSchedule('monthly', new Date('2026-10-31T14:00:00Z')).trialEnd).toEqual({ y: 2026, m: 11, d: 8 });
  });
  it('monthly copy', () => {
    expect(checkoutSummary('monthly', signup)).toBe("A$1 card check today. Your 7-day free trial ends on 20 October 2026. If you don't cancel before then, we'll charge A$39 on 20 October 2026, then A$39 every month on that date until you cancel.");
  });
  it('3-month copy', () => {
    expect(checkoutSummary('quarterly', signup)).toBe("A$1 card check today. Your 7-day free trial ends on 20 October 2026. If you don't cancel before then, we'll charge A$99 on 20 October 2026, then A$99 every 3 months until you cancel.");
  });
  it('29th-31st trial end explains short months', () => {
    expect(checkoutSummary('monthly', new Date('2027-01-23T23:00:00Z'))).toContain('on that date (or the last day of the month, in months without the 31st)');
  });
  it('cancel copy is plan-aware', () => {
    expect(cancelCopy('quarterly')).toContain('A$99');
    expect(cancelCopy('monthly')).toContain('A$39');
  });
});

describe('B2: server start_at equals the Sydney trial-end date shown in copy (DST sweep)', () => {
  it('every hour of 2026 and 2027: start_at falls on the copy date at 10:00 Sydney', () => {
    let mismatches = 0;
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 3600_000) {
      const signupAt = new Date(t);
      const charge = new Date(firstChargeUnix(signupAt) * 1000);
      const shown = trialEndDate(signupAt);
      const charged = sydneyDate(charge);
      const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Sydney', hour: 'numeric', hourCycle: 'h23' }).format(charge));
      if (charged.y !== shown.y || charged.m !== shown.m || charged.d !== shown.d || hour !== 10) mismatches++;
    }
    expect(mismatches).toBe(0);
  }, 60_000);
});
