import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('MCQ Review Queue sorting regression', () => {
  it('sorts the computed rows array rather than an undefined queue identifier', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/history/MCQReviewQueue.tsx'), 'utf8');

    expect(source).toContain('return rowSort(rows);');
    expect(source).not.toContain('return rowSort(queue);');
  });
});
