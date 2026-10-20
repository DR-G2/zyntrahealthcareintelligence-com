import { describe, expect, it } from 'vitest';
import { classifyPracticeResumeConfig } from './practice-mode-availability';

describe('Practice resume availability', () => {
  it.each([
    [{ mode: 'recharge', primaryMode: 'drill' }, 'allowed'],
    [{ mode: 'no-change' }, 'allowed'],
    [{ mode: 'recharge', primaryMode: 'mock' }, 'blocked'],
    [{ mode: 'full-mock' }, 'blocked'],
    [{ mode: 'recharge', primaryMode: 'nudge' }, 'blocked'],
    [{ mode: 'unknown', primaryMode: 'drill' }, 'unavailable'],
    [null, 'unavailable'],
    [undefined, 'unavailable'],
  ] as const)('classifies %s as %s', (config, expected) => {
    expect(classifyPracticeResumeConfig(config)).toBe(expected);
  });
});
