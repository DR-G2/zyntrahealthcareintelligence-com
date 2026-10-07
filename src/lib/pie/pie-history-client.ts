import { getSupabaseV2 } from '@/integrations/supabase/v2-client';
import { ensureV2Session } from '@/lib/migration/v2-practice-session';

/**
 * P5 learner history: the ONLY source of attempt history and answer keys for learner pages.
 * get_my_attempt_history returns the caller's own PIE attempts (adaptive or diagnostic) and
 * carries correct_answer / explanation only because each row is an answered attempt.
 * No page may read keys from the questions table.
 */
export interface PieHistoryRow {
  attempt_id: string; session_id: string; session_mode: 'adaptive' | 'diagnostic'; question_id: string; zyntra_id: string | null;
  stem: string; options: unknown; subject_id: string | null; subject_name: string | null; subtopic_id: string | null; subtopic_name: string | null;
  difficulty_tier: string | null; lo_id: string | null; lo_title: string | null; concept_title: string | null;
  selected_answer: string; is_correct: boolean; correct_answer: string | null; explanation: string | null;
  confidence_level: number | null; time_taken_seconds: number | null; time_to_first_click: number | null;
  answer_changes_count: number; change_sequence: unknown; question_position: number | null; created_at: string;
}

/** Legacy page shape (user_attempts joined to questions), produced from PIE history. */
export interface LegacyAttemptShape {
  id: string; question_id: string; session_id: string; selected_answer: string; is_correct: boolean;
  answer_changes_count: number; change_sequence: string[]; time_taken_seconds: number | null; time_to_first_click: number | null;
  confidence_level: number | null; created_at: string;
  questions: { question_text: string; correct_answer: string; category: string; subtopic: string | null; difficulty: string; explanation: string | null; options: string[] };
}

export interface ReviewDueRow {
  lo_id: string; lo_title: string; concept_title: string | null; subject_name: string | null; review_due_at: string;
  overdue_days: number; mastery: number; mastery_confidence: number; exposure_count: number; last_seen_at: string | null;
}

export interface HistoryDeps { ensureSession: () => Promise<void>; rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>; }
export const defaultHistoryDeps: HistoryDeps = {
  ensureSession: ensureV2Session,
  rpc: async (fn, args) => { const { data, error } = await getSupabaseV2().rpc(fn, args); return { data, error }; },
};

function optionList(options: unknown): string[] {
  if (Array.isArray(options)) return options.map(String);
  if (options && typeof options === 'object') return Object.values(options as Record<string, unknown>).map(String);
  return [];
}

export function toLegacyAttempt(r: PieHistoryRow): LegacyAttemptShape {
  return {
    id: r.attempt_id, question_id: r.question_id, session_id: r.session_id, selected_answer: r.selected_answer,
    is_correct: r.is_correct, answer_changes_count: r.answer_changes_count ?? 0,
    change_sequence: Array.isArray(r.change_sequence) ? (r.change_sequence as unknown[]).map(String) : [],
    time_taken_seconds: r.time_taken_seconds, time_to_first_click: r.time_to_first_click,
    confidence_level: r.confidence_level, created_at: r.created_at,
    questions: {
      question_text: r.stem, correct_answer: r.correct_answer ?? '', category: r.subject_name ?? 'Uncategorised',
      subtopic: r.subtopic_name ?? r.lo_title ?? null, difficulty: r.difficulty_tier ?? '', explanation: r.explanation, options: optionList(r.options),
    },
  };
}

export async function fetchPieAttemptHistory(limit = 1000, deps: HistoryDeps = defaultHistoryDeps): Promise<PieHistoryRow[]> {
  await deps.ensureSession();
  const n = Math.max(1, Math.min(5000, Math.floor(limit)));
  const { data, error } = await deps.rpc('get_my_attempt_history', { p_limit: n });
  if (error) throw new Error(error.message || 'History could not be loaded.');
  return (data as PieHistoryRow[]) || [];
}

/** Newest first (order: 'asc' for oldest first). */
export async function fetchLegacyShapedHistory(limit = 1000, order: 'desc' | 'asc' = 'desc', deps: HistoryDeps = defaultHistoryDeps): Promise<LegacyAttemptShape[]> {
  const rows = (await fetchPieAttemptHistory(limit, deps)).map(toLegacyAttempt);
  return order === 'asc' ? rows.reverse() : rows;
}

export async function fetchReviewDue(limit = 100, horizonDays = 0, deps: HistoryDeps = defaultHistoryDeps): Promise<ReviewDueRow[]> {
  await deps.ensureSession();
  const { data, error } = await deps.rpc('get_my_review_due', { p_limit: limit, p_horizon_days: horizonDays });
  if (error) throw new Error(error.message || 'Review items could not be loaded.');
  return (data as ReviewDueRow[]) || [];
}

/** Header that lets a learner-facing edge function read this learner's PIE history on V2 with their own JWT. */
export const PIE_V2_AUTH_HEADER = 'x-pie-v2-authorization';
export async function pieV2AuthHeaders(): Promise<Record<string, string>> {
  await ensureV2Session();
  const { data } = await getSupabaseV2().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('PIE session unavailable.');
  return { [PIE_V2_AUTH_HEADER]: `Bearer ${token}` };
}
