import { defaultHistoryDeps, toLegacyAttempt, type HistoryDeps, type LegacyAttemptShape, type PieHistoryRow } from '@/lib/pie/pie-history-client';

/**
 * Post-lock learner history (questions_paid_practice_only.sql + 0086).
 * Question content only via paid RPCs: practice results via get_practice_session_results,
 * review queue via get_my_review_queue_attempts. Analytics pages use get_my_attempt_summary (no content, paid).
 * No direct table reads, no fallback on refusal.
 */
export const PAYWALL_MESSAGE = 'This is available on paid plans. Upgrade to continue.';

/** Raised for SQLSTATE 42501. Deliberately carries no server detail (do not reveal which check failed). */
export class PaywallError extends Error {
  constructor() { super(PAYWALL_MESSAGE); this.name = 'PaywallError'; }
}
export const isPaywallError = (e: unknown): boolean => e instanceof PaywallError;

type RpcErr = { message?: string; code?: string } | null;
export type PaidHistoryDeps = Omit<HistoryDeps, 'rpc'> & { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcErr }> };

async function call<T>(deps: PaidHistoryDeps, fn: string, args: Record<string, unknown>, what: string): Promise<T[]> {
  await deps.ensureSession();
  const { data, error } = await deps.rpc(fn, args);
  if (error) {
    if (error.code === '42501') throw new PaywallError();
    throw new Error(`${what} could not be loaded.`);
  }
  return (data as T[]) || [];
}

const clamp = (n: number, max: number) => Math.max(1, Math.min(max, Math.floor(n)));
const deps0 = defaultHistoryDeps as PaidHistoryDeps;

export interface AttemptSummaryRow {
  attempt_id: string; session_id: string | null; created_at: string; subject_name: string | null; subtopic_name: string | null;
  difficulty_tier: string | null; is_correct: boolean; confidence_level: number | null; time_taken_seconds: number | null; answer_changes_count: number;
}
/** Paid. No question content, no answers/keys. */
export function fetchAttemptSummary(limit = 5000, deps: PaidHistoryDeps = deps0) {
  return call<AttemptSummaryRow>(deps, 'get_my_attempt_summary', { p_limit: clamp(limit, 5000) }, 'Performance summary');
}

export interface TrustGutRow {
  attempt_id: string; session_id: string | null; question_id: string; created_at: string; subject_name: string | null; subtopic_name: string | null;
  selected_answer: string; is_correct: boolean; answer_changes_count: number; change_sequence: unknown;
  time_taken_seconds: number | null; time_to_first_click: number | null;
  first_answer_correct: boolean | null; first_differs_from_final: boolean | null;
}
/** Paid. Newest first. */
export async function fetchTrustGutAttempts(limit = 5000, deps: PaidHistoryDeps = deps0) {
  const rows = await call<TrustGutRow>(deps, 'get_my_trust_gut_attempts', { p_limit: clamp(limit, 5000) }, 'Answer history');
  return rows.map((r) => ({ ...r, change_sequence: Array.isArray(r.change_sequence) ? (r.change_sequence as unknown[]).map(String) : [] as string[] }));
}

/** Paid. Review queue content from the caller's completed pie_adaptive sessions. Newest first. */
export async function fetchReviewQueueAttempts(limit = 2000, deps: PaidHistoryDeps = deps0): Promise<LegacyAttemptShape[]> {
  const rows = await call<PieHistoryRow>(deps, 'get_my_review_queue_attempts', { p_limit: clamp(limit, 5000) }, 'Review queue');
  return rows.map(toLegacyAttempt);
}

interface SessionRow { session_id: string; created_at: string; completed_at: string | null; question_count: number }
interface ResultRow {
  session_question_id: string; session_id: string; question_id: string; question_position: number | null; zyntra_id: string | null;
  stem: string; options: unknown; correct_answer: string | null; explanation: string | null; subject_id: string | null;
  subtopic_id: string | null; difficulty_tier: string | null; selected_answer: string | null; is_correct: boolean | null;
  confidence_level: number | null; time_taken_seconds: number | null; answer_changes_count: number | null;
}

/**
 * Paid. Practice history in the legacy page shape, read ONLY via get_my_practice_sessions +
 * get_practice_session_results. Attempt metadata (change path, first-click time, timestamp, subject name)
 * is merged from get_my_trust_gut_attempts (paid, no content). Newest first.
 */
export async function fetchPracticeResultsHistory(maxSessions = 50, deps: PaidHistoryDeps = deps0): Promise<LegacyAttemptShape[]> {
  const sessions = await call<SessionRow>(deps, 'get_my_practice_sessions', { p_limit: clamp(maxSessions, 200) }, 'Practice history');
  if (sessions.length === 0) return [];
  const [meta, ...results] = await Promise.all([
    fetchTrustGutAttempts(5000, deps),
    ...sessions.map((s) => call<ResultRow>(deps, 'get_practice_session_results', { p_session_id: s.session_id }, 'Practice results')),
  ]);
  const metaBy = new Map(meta.filter((m) => m.session_id).map((m) => [`${m.session_id}:${m.question_id}`, m]));
  const out: LegacyAttemptShape[] = [];
  sessions.forEach((s, i) => {
    for (const r of results[i] as ResultRow[]) {
      if (r.selected_answer == null || r.is_correct == null) continue; // unanswered
      const m = metaBy.get(`${r.session_id}:${r.question_id}`);
      out.push(toLegacyAttempt({
        attempt_id: m?.attempt_id ?? r.session_question_id, session_id: r.session_id, session_mode: 'pie_adaptive',
        question_id: r.question_id, zyntra_id: r.zyntra_id, stem: r.stem, options: r.options,
        subject_id: r.subject_id, subject_name: m?.subject_name ?? null, subtopic_id: r.subtopic_id, subtopic_name: m?.subtopic_name ?? null,
        difficulty_tier: r.difficulty_tier, lo_id: null, lo_title: null, concept_title: null,
        selected_answer: r.selected_answer, is_correct: r.is_correct, correct_answer: r.correct_answer, explanation: r.explanation,
        confidence_level: r.confidence_level, time_taken_seconds: r.time_taken_seconds, time_to_first_click: m?.time_to_first_click ?? null,
        answer_changes_count: r.answer_changes_count ?? 0, change_sequence: m?.change_sequence ?? [],
        question_position: r.question_position, created_at: m?.created_at ?? s.completed_at ?? s.created_at,
      }));
    }
  });
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
