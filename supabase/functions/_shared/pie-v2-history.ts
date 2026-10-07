// Pure helpers (no Deno/npm imports) so they are unit-tested by vitest and deno check.
// P5: learner-facing edge functions read the caller's PIE attempts from V2 via
// get_my_attempt_history, which returns only that learner's own ANSWERED attempts (so any
// correct_answer/explanation present is answered-only). Keys never leave the server.

export const PIE_V2_AUTH_HEADER = "x-pie-v2-authorization";

export interface PieHistoryRow {
  attempt_id: string; session_id: string; session_mode: string; question_id: string;
  stem: string; options: unknown; subject_name: string | null; subtopic_name: string | null;
  difficulty_tier: string | null; lo_title: string | null;
  selected_answer: string; is_correct: boolean; correct_answer: string | null; explanation: string | null;
  confidence_level: number | null; time_taken_seconds: number | null; time_to_first_click: number | null;
  answer_changes_count: number; change_sequence: unknown; question_position: number | null; created_at: string;
}

/** analyze-behavior shape: legacy user_attempts row + questions(category, difficulty, difficulty_tier, correct_answer), oldest first. */
export function toAnalyzeAttempts(rows: PieHistoryRow[]) {
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((r) => ({
    id: r.attempt_id, question_id: r.question_id, session_id: r.session_id,
    selected_answer: r.selected_answer, is_correct: r.is_correct,
    time_taken_seconds: r.time_taken_seconds, time_to_first_click: r.time_to_first_click,
    answer_changes_count: r.answer_changes_count ?? 0,
    change_sequence: Array.isArray(r.change_sequence) ? r.change_sequence : [],
    pause_events: null, confidence_level: r.confidence_level, question_position: r.question_position,
    created_at: r.created_at,
    questions: { category: r.subject_name ?? "Uncategorised", difficulty: r.difficulty_tier, difficulty_tier: r.difficulty_tier, correct_answer: r.correct_answer },
  }));
}

/** generate-flashcards: the learner's most recent wrong answers, distinct questions, newest first. */
export function toFlashcardSources(rows: PieHistoryRow[], maxAttempts = 50, maxQuestions = 20) {
  const wrong = [...rows].filter((r) => r.is_correct === false)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, maxAttempts);
  const seen = new Set<string>(); const out: { id: string; question_text: string; correct_answer: string | null; explanation: string | null; category: string; subtopic: string | null }[] = [];
  for (const r of wrong) {
    if (seen.has(r.question_id)) continue;
    seen.add(r.question_id);
    out.push({ id: r.question_id, question_text: r.stem, correct_answer: r.correct_answer, explanation: r.explanation, category: r.subject_name ?? "Uncategorised", subtopic: r.subtopic_name ?? r.lo_title });
    if (out.length >= maxQuestions) break;
  }
  return out;
}

/** The V2 (PIE) identity must be the same person as the V1 caller (the auth bridge links by email). */
export function sameLearner(v1Email: string | null | undefined, v2Email: string | null | undefined): boolean {
  return Boolean(v1Email && v2Email && v1Email.trim().toLowerCase() === v2Email.trim().toLowerCase());
}
