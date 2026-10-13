import { describe, it, expect } from 'vitest';
import { computeSchedule, checkoutSummary, BILLING_MODEL } from './billing';

// 2026-10-13 10:00 Sydney (AEDT) = 2026-10-12T23:00Z
const signup = new Date('2026-10-12T23:00:00Z');

describe('billing schedule (anniversary model)', () => {
  it('default model is anniversary', () => expect(BILLING_MODEL).toBe('anniversary'));
  it('monthly: trial ends +7 days Sydney; period is one full month from trial end', () => {
    const s = computeSchedule('monthly', signup);
    expect(s.trialEnd).toEqual({ y: 2026, m: 10, d: 20 });
    expect(s.periodEnd).toEqual({ y: 2026, m: 11, d: 19 });
    expect(s.firstCharge).toBe(39);
  });
  it('3-month: three full months from trial end, across year end', () => {
    const s = computeSchedule('quarterly', new Date('2026-11-29T01:00:00Z'));
    expect(s.trialEnd).toEqual({ y: 2026, m: 12, d: 6 });
    expect(s.periodEnd).toEqual({ y: 2027, m: 3, d: 5 });
    expect(s.firstCharge).toBe(99);
  });
  it('uses Sydney date, not UTC date', () => {
    expect(computeSchedule('monthly', new Date('2026-10-31T14:00:00Z')).trialEnd).toEqual({ y: 2026, m: 11, d: 8 });
  });
  it('monthly checkout copy', () => {
    expect(checkoutSummary('monthly', signup)).toBe("A$1 card check today. Your 7-day free trial ends on 20 October 2026. If you don't cancel before then, we'll charge A$39 on 20 October 2026, then A$39 every month on that date until you cancel.");
  });
  it('3-month checkout copy', () => {
    expect(checkoutSummary('quarterly', signup)).toBe("A$1 card check today. Your 7-day free trial ends on 20 October 2026. If you don't cancel before then, we'll charge A$99 on 20 October 2026, then A$99 every 3 months until you cancel.");
  });
});
