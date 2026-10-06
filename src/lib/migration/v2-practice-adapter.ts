import { getSupabaseV2 } from '@/integrations/supabase/v2-client';

export interface V2AttemptInput {
  questionId: string;
  sessionId: string;
  selectedAnswer: string;
  timeTakenSeconds?: number | null;
  confidenceLevel?: number | null;
  answerChangesCount?: number;
  timeToFirstClick?: number | null;
  changeSequence?: unknown[] | null;
  pauseEvents?: unknown[] | null;
  timeOfDay?: string | null;
  questionPosition?: number | null;
  previousQuestionCorrect?: boolean | null;
  questionVersion?: number | null;
  appVersion?: string | null;
  provenance?: Record<string, unknown>;
}

export interface V2AttemptRecord {
  id: string;
  user_id: string;
  question_id: string;
  session_id: string | null;
  selected_answer: string;
  is_correct: boolean;
  confidence_level: number | null;
  time_taken_seconds: number | null;
  answer_changes_count: number;
  created_at: string;
}

/**
 * Phase 9 compatibility boundary.
 *
 * This is intentionally NOT wired into /practice yet.
 * It only talks to the V2 save_attempt RPC, which enforces authentication
 * and V2 practice-session ownership on the database side.
 *
 * sessionId must be a V2 practice_sessions.id.
 * A legacy active_sessions.id must never be passed here.
 */
export async function saveAttemptToV2(input: V2AttemptInput): Promise<V2AttemptRecord> {
  if (!input.questionId) throw new Error('V2 attempt requires a question id.');
  if (!input.sessionId) throw new Error('V2 attempt requires a V2 session id.');
  if (!input.selectedAnswer) throw new Error('V2 attempt requires a selected answer.');

  if (
    input.confidenceLevel !== null &&
    input.confidenceLevel !== undefined &&
    (!Number.isInteger(input.confidenceLevel) ||
      input.confidenceLevel < 1 ||
      input.confidenceLevel > 5)
  ) {
    throw new Error('Confidence must be between 1 and 5.');
  }

  const { data, error } = await getSupabaseV2().rpc('save_attempt', {
    p_question_id: input.questionId,
    p_session_id: input.sessionId,
    p_selected_answer: input.selectedAnswer,
    // Required for RPC compatibility. The V2 function ignores this client-supplied value
    // and derives correctness from the protected question answer key.
    p_is_correct: false,
    p_time_taken_seconds: input.timeTakenSeconds ?? null,
    p_confidence_level: input.confidenceLevel ?? null,
    p_answer_changes_count: input.answerChangesCount ?? 0,
    p_time_to_first_click: input.timeToFirstClick ?? null,
    p_change_sequence: input.changeSequence ?? null,
    p_pause_events: input.pauseEvents ?? null,
    p_time_of_day: input.timeOfDay ?? null,
    p_question_position: input.questionPosition ?? null,
    p_previous_question_correct: input.previousQuestionCorrect ?? null,
    p_question_version: input.questionVersion ?? null,
    p_app_version: input.appVersion ?? null,
    p_provenance: input.provenance ?? {},
  });

  if (error) {
    throw new Error(error.message || 'V2 attempt could not be saved.');
  }

  return data as V2AttemptRecord;
}

/**
 * Migration gate only. This does not enable V2 Practice.
 */
export function isV2PracticeEnabled(): boolean {
  return import.meta.env.VITE_SUPABASE_V2_PRACTICE_ENABLED === 'true';
}
