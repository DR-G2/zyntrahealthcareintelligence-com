import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDrillBehaviouralFeedback } from '@/lib/drill-results-feedback';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Drill Complete evidence and review presentation', () => {
  it('returns no behavioural message after a one-question drill', () => {
    expect(getDrillBehaviouralFeedback({
      total: 1, totalChanges: 0, avgTime: 7, accuracy: 0,
      easyWrong: 1, hardCorrect: 0, weaknesses: ['Adult Medicine'],
    })).toBeNull();
  });

  it('shows the rushing-related factual message when the five-question evidence rule and thresholds are met', () => {
    expect(getDrillBehaviouralFeedback({
      total: 5, totalChanges: 0, avgTime: 7, accuracy: 40,
      easyWrong: 0, hardCorrect: 0, weaknesses: [],
    })).toBe('Average time is under 30 seconds with accuracy below 60%.');
  });

  it('preserves the rushing heuristic thresholds behind the evidence gate', () => {
    const practice = read('src/pages/Practice.tsx');
    expect(read('src/lib/drill-results-feedback.ts')).toContain('if (avgTime < 30 && accuracy < 60)');
    expect(practice).toContain('getDrillBehaviouralFeedback({');
    expect(read('src/lib/drill-results-feedback.ts')).toContain('if (total < 5) return null;');
    expect(read('src/lib/drill-results-feedback.ts')).toContain('Average time is under 30 seconds with accuracy below 60%.');
  });

  it('uses factual elimination wording and removes accuracy percentages and judgement badges', () => {
    const practice = read('src/pages/Practice.tsx');
    expect(practice).toContain('Wrong options ruled out:');
    expect(practice).toContain('Correct answer kept:');
    expect(practice).not.toContain('Elimination Accuracy');
    expect(practice).not.toContain('Elimination Score:');
    expect(practice).not.toContain('Good elimination');
    expect(practice).not.toContain('🧠 Rule-Out Intelligence');
  });

  it('passes existing per-question confidence ratings into results and displays them when present', () => {
    const session = read('src/components/practice/PieDrillSession.tsx');
    const practice = read('src/pages/Practice.tsx');
    expect(session).toContain('confidenceRatings: Record<number, number>');
    expect(session).toContain('ruledOut, confidence, nudgeOutcome');
    expect(practice).toContain('confidenceRatings={resultData.confidenceRatings}');
    expect(practice).toContain('Confidence: <strong>{confidenceRatings[i]}/5</strong>');
  });

  it('keeps mobile actions above the app bottom navigation with safe-area spacing', () => {
    const practice = read('src/pages/Practice.tsx');
    expect(practice).toContain('bottom-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(practice).toContain('Start New Drill');
    expect(practice).toContain('View Intelligence');
    expect(practice.indexOf('/* ── SECTION 2: Full Question Review ── */')).toBeLessThan(practice.lastIndexOf('Start New Drill'));
  });
});
