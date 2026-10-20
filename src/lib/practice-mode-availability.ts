export type PracticeResumeAvailability = 'allowed' | 'blocked' | 'unavailable';

/**
 * Only resume sessions whose stored mode can be positively identified as Normal MCQ.
 * This is a client-side visibility guard, not a replacement for server authorization.
 */
export function classifyPracticeResumeConfig(config: unknown): PracticeResumeAvailability {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 'unavailable';
  const saved = config as Record<string, unknown>;
  const mode = saved.mode;
  const primaryMode = saved.primaryMode;

  if (primaryMode === 'mock' || primaryMode === 'nudge' || mode === 'full-mock') return 'blocked';
  const knownNormalMode = mode === 'recharge' || mode === 'no-change';
  const knownPrimaryMode = primaryMode === undefined || primaryMode === 'drill';
  return knownNormalMode && knownPrimaryMode ? 'allowed' : 'unavailable';
}
