/**
 * Single write path for learner attempts (PR #56 review, B1).
 *
 * Every attempt goes through the V2 server-authoritative RPCs:
 *   ensureV2Session -> create_practice_session -> save_attempt (server-graded) -> complete_practice_session
 * There is no direct `user_attempts` table write and no fallback to one: any failure throws,
 * and the caller surfaces it as a hard error.
 */
import { ensureV2Session, createV2PracticeSession, completeV2PracticeSession } from './v2-practice-session';
import { saveAttemptToV2 } from './v2-practice-adapter';

export interface AttemptToPersist {
  questionId: string;
  selectedAnswer: string;
  timeTakenSeconds?: number | null;
  confidenceLevel?: number | null;
  answerChangesCount?: number;
  timeToFirstClick?: number | null;
  changeSequence?: string[] | null;
  pauseEvents?: unknown[] | null;
  questionPosition?: number | null;
}

export interface PersistDeps {
  ensureSession: typeof ensureV2Session;
  createSession: typeof createV2PracticeSession;
  saveAttempt: typeof saveAttemptToV2;
  completeSession: typeof completeV2PracticeSession;
}

const defaultDeps: PersistDeps = {
  ensureSession: ensureV2Session,
  createSession: createV2PracticeSession,
  saveAttempt: saveAttemptToV2,
  completeSession: completeV2PracticeSession,
};

/** Persists answered attempts in one completed V2 session. Unanswered items are skipped. */
export async function persistAttemptsViaV2(
  sessionType: string,
  config: Record<string, unknown>,
  attempts: AttemptToPersist[],
  deps: PersistDeps = defaultDeps,
): Promise<{ sessionId: string | null; saved: number }> {
  const answered = attempts.filter((a) => typeof a.selectedAnswer === 'string' && a.selectedAnswer.length > 0);
  if (answered.length === 0) return { sessionId: null, saved: 0 };
  await deps.ensureSession();
  const session = await deps.createSession(sessionType, config, answered.map((a) => a.questionId));
  for (const a of answered) {
    await deps.saveAttempt({
      questionId: a.questionId,
      sessionId: session.id,
      selectedAnswer: a.selectedAnswer,
      timeTakenSeconds: a.timeTakenSeconds ?? null,
      confidenceLevel: a.confidenceLevel ?? null,
      answerChangesCount: a.answerChangesCount ?? 0,
      timeToFirstClick: a.timeToFirstClick ?? null,
      changeSequence: a.changeSequence ?? null,
      pauseEvents: a.pauseEvents ?? null,
      timeOfDay: new Date().toISOString(),
      questionPosition: a.questionPosition ?? null,
      previousQuestionCorrect: null,
      provenance: { source: `${sessionType}-v2-attempt-writer` },
    } as Parameters<typeof saveAttemptToV2>[0]);
  }
  await deps.completeSession(session.id);
  return { sessionId: session.id, saved: answered.length };
}
