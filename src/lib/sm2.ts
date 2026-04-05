/**
 * SM-2 Spaced Repetition Algorithm (Anki-style)
 * Quality: 0-5 (0=total blackout, 5=perfect recall)
 *   Again = 0, Hard = 2, Good = 3, Easy = 5
 */

export interface SM2State {
  easeFactor: number;
  interval: number; // days
  repetitions: number;
}

export interface SM2Result extends SM2State {
  nextReviewAt: Date;
}

export function sm2(state: SM2State, quality: number): SM2Result {
  const { easeFactor, interval, repetitions } = state;

  let newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEF < 1.3) newEF = 1.3;

  let newInterval: number;
  let newReps: number;

  if (quality < 3) {
    // Failed — reset
    newInterval = 0;
    newReps = 0;
  } else {
    newReps = repetitions + 1;
    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEF);
    }
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

  return {
    easeFactor: Math.round(newEF * 100) / 100,
    interval: newInterval,
    repetitions: newReps,
    nextReviewAt,
  };
}

export const QUALITY_MAP = {
  again: 0,
  hard: 2,
  good: 3,
  easy: 5,
} as const;

export type QualityLabel = keyof typeof QUALITY_MAP;
