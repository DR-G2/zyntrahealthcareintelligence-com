import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const reads = vi.hoisted(() => ({ fail: false, plan: null as unknown, perf: null as unknown }));
vi.mock('@/components/AppLayout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/SubscriptionTimer', () => ({ SubscriptionTimer: () => null }));
const auth = { user: { id: 'candidate-a' }, profile: { exam_date: null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useFeatureGate', () => ({ useFeatureGate: () => ({ canAccessStudyPlan: true }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => {
  const response = () => Promise.resolve({ data: table === 'study_plans' ? reads.plan : table === 'readiness_dna' ? reads.perf : [], error: reads.fail ? { message: 'Read unavailable' } : null });
  return { select: () => ({ eq: () => ({ maybeSingle: response, order: response }) }) };
} } }));
import Plan, { formatPlanMetric, isValidPlan } from './Plan';

beforeEach(() => { reads.fail = false; reads.plan = null; reads.perf = null; });
describe('Study Plan evidence states', () => {
  it('never substitutes zero for missing readiness evidence', () => {
    expect(formatPlanMetric(null)).toBe('Unavailable');
    expect(formatPlanMetric(0)).toBe('0%');
    expect(formatPlanMetric(72)).toBe('72%');
  });
  it('rejects malformed schedules rather than displaying invented tasks', () => {
    expect(isValidPlan({ focus_areas: [], weekly_schedule: [{ day: 'Monday', total_questions: 10, topics: null }] })).toBe(false);
    expect(isValidPlan({ focus_areas: [], weekly_schedule: [] })).toBe(true);
  });
  it('distinguishes failed plan reads from an empty saved plan and retries', async () => {
    reads.fail = true;
    render(<MemoryRouter><Plan /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('No active plan yet')).toBeNull();
    reads.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No active plan yet')).toBeInTheDocument();
  });
  it('renders the saved task order without creating completion states', async () => {
    reads.plan = { tasks: { focus_areas: [{ category: 'Medicine', priority: 'high', daily_questions: 12 }], weekly_schedule: [{ day: 'Monday', total_questions: 12, topics: [{ category: 'Medicine', count: 12, focus_note: 'Review recorded errors' }] }] }, generated_at: null };
    render(<MemoryRouter><Plan /></MemoryRouter>);
    expect(await screen.findByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Review recorded errors')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open practice', exact: true })).toHaveAttribute('href', '/practice');
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});