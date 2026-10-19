import { getSupabaseV2 } from '@/integrations/supabase/v2-client';
import {
  ensureV2Session,
  completeV2PracticeSession,
  getV2PracticeResults,
  resumeV2PracticeSession,
  type V2PracticeQuestion,
  type V2PracticeResult,
} from '@/lib/migration/v2-practice-session';
import { saveAttemptToV2, type V2AttemptInput, type V2AttemptRecord } from '@/lib/migration/v2-practice-adapter';

/**
 * P5: the only Practice data path. Questions are chosen by the server (PIE) and delivered
 * without an answer key or explanation; correctness is graded server-side by save_attempt,
 * and the key/explanation come back only from get_practice_session_results, only for
 * answered questions. There is no client-side selector and no client-visible key.
 */
export type PieSessionQuestion = Omit<V2PracticeQuestion, 'correct_answer' | 'explanation'>;

export interface PieDeps {
  ensureSession: () => Promise<void>;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
  saveAttempt: (input: V2AttemptInput) => Promise<V2AttemptRecord>;
  complete: (sessionId: string) => Promise<unknown>;
  results: (sessionId: string) => Promise<V2PracticeResult[]>;
  resume: (sessionId: string) => Promise<unknown>;
}

export const defaultPieDeps: PieDeps = {
  ensureSession: ensureV2Session,
  rpc: async (fn, args) => {
    const { data, error } = await getSupabaseV2().rpc(fn, args);
    return { data, error };
  },
  saveAttempt: saveAttemptToV2,
  complete: completeV2PracticeSession,
  results: getV2PracticeResults,
  resume: resumeV2PracticeSession,
};

/** Strip anything key-like defensively, even though the RPC never returns it. */
function sanitize(q: Record<string, unknown>): PieSessionQuestion {
  const { correct_answer: _k, explanation: _e, ...rest } = q as Record<string, unknown> & { correct_answer?: unknown; explanation?: unknown };
  return rest as unknown as PieSessionQuestion;
}

async function call<T>(deps: PieDeps, fn: string, args: Record<string, unknown>, what: string): Promise<T> {
  const { data, error } = await deps.rpc(fn, args);
  if (error) throw new Error(error.message || `${what} failed.`);
  return data as T;
}

export async function loadSessionQuestions(sessionId: string, deps: PieDeps = defaultPieDeps): Promise<PieSessionQuestion[]> {
  const rows = await call<Record<string, unknown>[]>(deps, 'get_practice_session_questions', { p_session_id: sessionId }, 'Loading questions');
  return (rows || []).map(sanitize).sort((a, b) => a.question_position - b.question_position);
}

export interface NudgeSessionTarget {
  /** Null for cold-start or mixed-practice sessions that are building evidence rather than targeting one LO. */
  loId: string | null;
  loKey: string;
  loTitle: string;
  baselineAccuracy: number;
  baselineQuestionCount: number;
  reasonCode: string;
}

export function isNudgeColdStart(target: NudgeSessionTarget | null | undefined): boolean {
  return Boolean(target && (!target.loId || target.reasonCode === 'COLD_START_FIRST_50' || target.reasonCode === 'MIXED_PRACTICE_NO_SUPPORTED_TARGET'));
}

export async function startNudgeSession(count: number, deps: PieDeps = defaultPieDeps): Promise<{ sessionId: string; questions: PieSessionQuestion[]; target: NudgeSessionTarget }> {
  await deps.ensureSession();
  const n = Math.max(3, Math.min(20, Math.floor(count)));
  let rows: {
    session_id: string; question_count: number; lo_id: string | null; lo_key: string | null; lo_title: string | null;
    baseline_accuracy: number | null; baseline_question_count: number; reason_code: string;
  }[];
  try {
    rows = await call<{
      session_id: string; question_count: number; lo_id: string | null; lo_key: string | null; lo_title: string | null;
      baseline_accuracy: number | null; baseline_question_count: number; reason_code: string;
    }[]>(deps, 'create_my_nudge_session', { p_count: n }, 'Preparing your Nudge session');
  } catch (error) {
    const message = (error as Error).message || '';
    if (/NO_MAPPED_ATTEMPTS|FEWER_THAN_THREE_DISTINCT_MAPPED_QUESTIONS/.test(message)) {
      throw new Error('Nudge could not start its mixed-practice evidence-building session. Continue MCQ Drill while we check the eligible question pool.');
    }
    if (/NO_OBJECTIVE_MEETS_EVIDENCE_THRESHOLD/.test(message)) {
      throw new Error('Your saved attempts do not yet demonstrate a sufficiently supported learning gap. Nudge should continue with mixed practice while evidence builds.');
    }
    if (/FEWER_THAN_THREE_UNSEEN_MAPPED_QUESTIONS|NUDGE_NO_ELIGIBLE_QUESTIONS/.test(message)) {
      throw new Error('Nudge could not find enough eligible questions for this session. Please try MCQ Drill while the question pool is checked.');
    }
    throw error;
  }
  const row = rows?.[0];
  const coldStart = row?.reason_code === 'COLD_START_FIRST_50' || row?.reason_code === 'MIXED_PRACTICE_NO_SUPPORTED_TARGET';
  if (!row?.session_id || !row.question_count || row.question_count < 3 || (!row.lo_id && !coldStart)) {
    throw new Error('Nudge could not create a sufficiently supported session.');
  }
  return {
    sessionId: row.session_id,
    questions: await loadSessionQuestions(row.session_id, deps),
    target: {
      loId: row.lo_id ?? null,
      loKey: row.lo_key ?? 'MIXED_PRACTICE',
      loTitle: row.lo_title ?? 'Mixed practice · building your PIE evidence',
      baselineAccuracy: row.baseline_accuracy == null ? 0 : Number(row.baseline_accuracy),
      baselineQuestionCount: Number(row.baseline_question_count),
      reasonCode: row.reason_code,
    },
  };
}

export async function getNudgeProgress(loId: string, deps: PieDeps = defaultPieDeps): Promise<{ attemptCount: number; distinctQuestionCount: number; correctCount: number; accuracy: number | null }> {
  const rows = await call<{ status: string; attempt_count: number; distinct_question_count: number; correct_count: number; accuracy: number | null }[]>(
    deps, 'get_my_nudge_progress', { p_lo_id: loId }, 'Reassessing Nudge progress',
  );
  const row = rows?.[0];
  if (!row || row.status !== 'READY') throw new Error('Nudge reassessment is not available yet.');
  return {
    attemptCount: Number(row.attempt_count),
    distinctQuestionCount: Number(row.distinct_question_count),
    correctCount: Number(row.correct_count),
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
  };
}

export async function startPieSession(count: number, deps: PieDeps = defaultPieDeps): Promise<{ sessionId: string; questions: PieSessionQuestion[] }> {
  await deps.ensureSession();
  const n = Math.max(1, Math.min(50, Math.floor(count)));
  const rows = await call<{ session_id: string; question_count: number }[]>(deps, 'pie_create_session', { p_count: n }, 'Starting an adaptive session');
  const sessionId = rows?.[0]?.session_id;
  if (!sessionId) throw new Error('Adaptive session was not created.');
  return { sessionId, questions: await loadSessionQuestions(sessionId, deps) };
}

export const PIE_DIAGNOSTIC_DEFAULT_COUNT = 20;

/**
 * P5 diagnostic: a server-built, blueprint-balanced fixed set (pie_create_session with
 * p_mode 'pie_diagnostic'), registered in pie.adaptive_session, so every answer is graded by
 * save_attempt and counts as PIE evidence. The server enforces 10..50 items, one active
 * diagnostic and one new diagnostic per 24 h; those errors are surfaced as-is.
 */
export async function startPieDiagnostic(count: number = PIE_DIAGNOSTIC_DEFAULT_COUNT, deps: PieDeps = defaultPieDeps): Promise<{ sessionId: string; questions: PieSessionQuestion[] }> {
  await deps.ensureSession();
  const n = Math.max(10, Math.min(50, Math.floor(count)));
  const rows = await call<{ session_id: string; question_count: number }[]>(deps, 'pie_create_session',
    { p_count: n, p_blueprint_key: 'AMC_CAT_MCQ', p_mode: 'pie_diagnostic' }, 'Starting the diagnostic');
  const sessionId = rows?.[0]?.session_id;
  if (!sessionId) throw new Error('Diagnostic session was not created.');
  return { sessionId, questions: await loadSessionQuestions(sessionId, deps) };
}

/** Human-readable messages for the server's session-creation refusals. */
export function pieSessionErrorMessage(message: string): string {
  if (/PIE_DIAGNOSTIC_ACTIVE/.test(message)) return 'You already have a diagnostic in progress. Resume it to continue.';
  if (/PIE_DIAGNOSTIC_RATE_LIMITED/.test(message)) return 'You can take one diagnostic every 24 hours. Use adaptive Practice meanwhile.';
  if (/PIE_RATE_LIMITED/.test(message)) return 'Please wait a few seconds before starting another session.';
  if (/PIE_TOO_MANY_ACTIVE_SESSIONS/.test(message)) return 'You have too many sessions open. Finish one first.';
  if (/PIE_NO_ELIGIBLE_CANDIDATE/.test(message)) return 'No questions are available right now.';
  return message;
}

export async function resumePieSession(sessionId: string, deps: PieDeps = defaultPieDeps): Promise<PieSessionQuestion[]> {
  await deps.ensureSession();
  await deps.resume(sessionId);
  return loadSessionQuestions(sessionId, deps);
}

/** Appends one server-selected question. The server refuses while a served question is unanswered. */
export async function nextPieQuestion(sessionId: string, deps: PieDeps = defaultPieDeps): Promise<PieSessionQuestion | null> {
  const { error } = await deps.rpc('pie_next_question', { p_session_id: sessionId });
  if (error) {
    if (/PIE_NO_ELIGIBLE_CANDIDATE/.test(error.message || '')) return null;
    throw new Error(error.message || 'Next question failed.');
  }
  const all = await loadSessionQuestions(sessionId, deps);
  return all[all.length - 1] ?? null;
}

export async function submitPieAnswer(input: V2AttemptInput, deps: PieDeps = defaultPieDeps): Promise<void> {
  await deps.saveAttempt(input);
}

export async function finishPieSession(sessionId: string, deps: PieDeps = defaultPieDeps): Promise<V2PracticeResult[]> {
  await deps.complete(sessionId);
  return deps.results(sessionId);
}
