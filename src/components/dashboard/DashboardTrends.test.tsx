import { describe, expect, it } from 'vitest';
import { summarizeWeeklyTrend } from './DashboardTrends';

describe('summarizeWeeklyTrend', () => {
  it('groups only real scored attempts by their recorded week', () => {
    const points = summarizeWeeklyTrend([
      { id: 'a', created_at: '2026-10-05T10:00:00.000Z', is_correct: true },
      { id: 'b', created_at: '2026-10-06T10:00:00.000Z', is_correct: false },
      { id: 'c', created_at: '2026-10-12T10:00:00.000Z', is_correct: true },
      { id: 'd', created_at: '2026-10-13T10:00:00.000Z', is_correct: true },
      { id: 'e', created_at: '2026-10-13T10:00:00.000Z', is_correct: null },
    ]);
    expect(points).toEqual([
      { key: '2026-10-05', label: 'Oct 5', correct: 1, scoredAttempts: 2, accuracy: 50 },
      { key: '2026-10-12', label: 'Oct 12', correct: 2, scoredAttempts: 2, accuracy: 100 },
    ]);
  });

  it('does not invent data for missing dates or unscored attempts', () => {
    expect(summarizeWeeklyTrend([
      { created_at: null, is_correct: true },
      { created_at: 'not-a-date', is_correct: false },
      { created_at: '2026-10-13T10:00:00.000Z', is_correct: null },
    ])).toEqual([]);
  });

  it('keeps only the latest four active weeks', () => {
    const rows = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'].map((date, index) => ({
      id: String(index), created_at: date + 'T10:00:00.000Z', is_correct: true,
    }));
    expect(summarizeWeeklyTrend(rows).map(point => point.key)).toEqual([
      '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12',
    ]);
  });
});
