/**
 * PIE P2 per-LO learner state: TypeScript reference of SQL policy `pie-lo-state/p2.0`
 * (supabase/migrations_v2/0046_pie_p2_learner_lo_state.sql, pie.recompute_learner_lo_state).
 *
 * The database function is authoritative; this module exists so the policy can be unit
 * tested and so the UI can type the learner-safe projection returned by
 * public.get_my_lo_state(). It never sees answer keys: callers pass already-graded
 * attempts (`correct`, `firstAnswerCorrect`) as produced server-side.
 */
export const LO_STATE_POLICY_VERSION = "pie-lo-state/p2.0";
export const GUESS_FLOOR = 0.2;

export interface GradedAttempt {
  attemptId: string;
  questionId: string;
  at: string;
  correct: boolean;
  firstAnswerCorrect: boolean | null;
  confidenceLevel: number | null; // 1..5
  timeTakenSeconds: number | null;
  answerChanges: number;
  irtB: number | null;
  loWeight: number; // question_lo.weight, (0,1]
}

export interface LoStateDerived {
  mastery: number;
  masteryConfidence: number;
  abilityTheta: number;
  exposureCount: number;
  fragileCorrect: number;
  confidentWrong: number;
  firstAnswerCorrectRate: number | null;
  finalAnswerCorrectRate: number;
  meanConfidenceNormalized: number | null;
  calibrationGap: number | null;
  lastSeenAt: string | null;
  reviewDueAt: null; // reserved for P6 spaced review
}

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

export function pCorrect(theta: number, b: number, c = GUESS_FLOOR): number {
  return c + (1 - c) * logistic(theta - b);
}

export function confidenceNormalized(level: number | null): number | null {
  return level == null ? null : (level - 1) / 4;
}

/** Attempts must already be ordered by (created_at, id), as in SQL. */
export function deriveLoState(attempts: GradedAttempt[]): LoStateDerived | null {
  if (attempts.length === 0) return null;
  let theta = 0, info = 0, n = 0, correctN = 0, fragile = 0, cwrong = 0;
  let confSum = 0, confN = 0, facKnown = 0, facN = 0;
  let last: string | null = null;
  for (const a of attempts) {
    n += 1;
    const b = a.irtB ?? 0;
    const y = a.correct ? 1 : 0;
    const p = pCorrect(theta, b);
    const k = 1.2 / (1 + 0.15 * (n - 1));
    theta += a.loWeight * k * (y - p);
    info += a.loWeight * p * (1 - p);
    correctN += y;
    last = a.at;
    const conf = confidenceNormalized(a.confidenceLevel);
    if (conf != null) { confSum += conf; confN += 1; }
    if (a.firstAnswerCorrect != null) { facKnown += 1; if (a.firstAnswerCorrect) facN += 1; }
    if (a.correct && ((conf != null && conf <= 0.25) || a.firstAnswerCorrect === false)) fragile += 1;
    if (!a.correct && conf != null && conf >= 0.75) cwrong += 1;
  }
  return {
    mastery: round(logistic(theta), 6),
    masteryConfidence: round(1 - 1 / Math.sqrt(1 + info), 6),
    abilityTheta: round(theta, 6),
    exposureCount: n,
    fragileCorrect: fragile,
    confidentWrong: cwrong,
    firstAnswerCorrectRate: facKnown ? round(facN / facKnown, 4) : null,
    finalAnswerCorrectRate: round(correctN / n, 4),
    meanConfidenceNormalized: confN ? round(confSum / confN, 4) : null,
    calibrationGap: confN ? round(confSum / confN - correctN / n, 4) : null,
    lastSeenAt: last,
    reviewDueAt: null,
  };
}

/** Learner-safe row shape of public.get_my_lo_state(). */
export interface MyLoStateRow {
  lo_key: string;
  concept_key: string;
  mastery: number;
  mastery_confidence: number;
  exposure_count: number;
  distinct_question_count: number;
  outcome_history: unknown;
  last_seen_at: string | null;
  review_due_at: string | null;
  difficulty_history: unknown;
  misconception_state: unknown;
  confidence_state: unknown;
  behaviour_state: unknown;
  fragile_correct: number;
  confident_wrong: number;
  policy_version: string;
  computed_at: string;
}
