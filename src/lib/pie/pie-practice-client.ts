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

export async function startPieSession(count: number, deps: PieDeps = defaultPieDeps): Promise<{ sessionId: string; questions: PieSessionQuestion[] }> {
  await deps.ensureSession();
  const n = Math.max(1, Math.min(50, Math.floor(count)));
  const rows = await call<{ session_id: string; question_count: number }[]>(deps, 'pie_create_session', { p_count: n, p_blueprint_key: 'ZYNTRA_GENERAL' }, 'Starting an adaptive session');
  const sessionId = rows?.[0]?.session_id;
  if (!sessionId) throw new Error('Adaptive session was not created.');
  return { sessionId, questions: await loadSessionQuestions(sessionId, deps) };
}

export const PIE_DIAGNOSTIC_DEFAULT_COUNT = 20;

/**
 * General diagnostic: a server-built subject-balanced fixed set using the exam-neutral
 * ZYNTRA_GENERAL key. It is not an AMC blueprint simulation. The server enforces 10..50 items,
 * one active diagnostic and one new diagnostic per 24 h; those errors are surfaced as-is.
 */
export async function startPieDiagnostic(count: number = PIE_DIAGNOSTIC_DEFAULT_COUNT, deps: PieDeps = defaultPieDeps): Promise<{ sessionId: string; questions: PieSessionQuestion[] }> {
  await deps.ensureSession();
  const n = Math.max(10, Math.min(50, Math.floor(count)));
  const rows = await call<{ session_id: string; question_count: number }[]>(deps, 'pie_create_session',
    { p_count: n, p_blueprint_key: 'ZYNTRA_GENERAL', p_mode: 'pie_diagnostic' }, 'Starting the diagnostic');
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
