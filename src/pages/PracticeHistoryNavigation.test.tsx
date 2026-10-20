import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Practice layout and history entry points', () => {
  it('removes the redundant Practice history buttons without removing the underlying views', () => {
    const practice = read('src/pages/Practice.tsx');
    expect(practice).not.toContain('> Review Queue</Button>');
    expect(practice).not.toContain('> MCQ History</Button>');
    expect(practice).toContain('<MCQHistory />');
    expect(practice).toContain('<MCQReviewQueue />');
  });

  it('keeps Normal MCQ as the visible available mode and preserves the screen-reader announcement', () => {
    const practice = read('src/pages/Practice.tsx');
    const selector = read('src/components/practice/PracticeModeSelector.tsx');
    expect(practice).not.toContain('Normal MCQ is the available practice mode.');
    expect(selector).toContain('Available now');
    expect(selector).toContain('role="status"');
    expect(selector).toContain('Normal MCQ is available. AMC Exam Mode and Nudge are under construction and unavailable.');
  });

  it('keeps the browser timer tied to the selected question load', () => {
    const practice = read('src/pages/Practice.tsx');
    expect(practice).toContain('Up to {MAX_SESSION_QUESTIONS} questions · {questionCount}-minute browser timer.');
    expect(practice).toContain('questionCount,');
  });

  it('shows a Review Queue tab and redirects legacy review URLs to it', () => {
    const history = read('src/pages/History.tsx');
    const app = read('src/App.tsx');
    expect(history).toContain("{ id: 'review', label: 'Review Queue' }");
    expect(history).toContain("requestedTab === 'review'");
    expect(history).toContain('<MCQReviewQueue />');
    expect(app).toContain('<Route path="/review" element={<LegacyRedirect to="/history" tab="review" />} />');
  });

  it('does not render a literal zero for subjects without a positive question count', () => {
    const practice = read('src/pages/Practice.tsx');
    expect(practice).toContain('{subjectCounts[subject.name] > 0 && (');
    expect(practice).not.toContain('{subjectCounts[subject.name] || 0}');
  });
});
