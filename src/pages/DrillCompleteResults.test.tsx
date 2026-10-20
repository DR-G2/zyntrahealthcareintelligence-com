import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Drill Complete evidence and review presentation', () => {
  it('withholds behavioural feedback below five questions, including a one-question drill', () => {
    const practice = read('src/pages/Practice.tsx');
    expect(practice).toContain('if (total < 5) return null;');
    expect(practice).toContain('{generateInsight() && (');
    expect(practice).not.toContain("You're rushing through questions");
  });

  it('preserves the rushing heuristic thresholds behind the evidence gate', () => {
    const practice = read('src/pages/Practice.tsx');
    expect(practice).toContain('if (avgTime < 30 && accuracy < 60)');
    expect(practice).toContain('if (total < 5) return null;');
    expect(practice).toContain('Average time is under 30 seconds with accuracy below 60%.');
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
