import { ensureV2Session } from '@/lib/migration/v2-practice-session';
import { getSupabaseV2 } from '@/integrations/supabase/v2-client';
import { fetchPieAttemptHistory, type PieHistoryRow } from './pie-history-client';
import { PIE_MIN_OBSERVATIONS } from './pie-state';

export const DIMENSIONS = ['capability', 'decision', 'timing', 'calibration', 'sustained_performance', 'learning'] as const;
export type Dimension = typeof DIMENSIONS[number];
export type PracticeMode = 'normal_mcq' | 'amc_exam' | 'nudge';

export function normalizePracticeMode(value: unknown): PracticeMode | null {
  if (typeof value !== 'string') return null;
  const mode = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  if (mode === 'nudge') return 'nudge';
  if (mode === 'exam' || mode === 'amc_exam' || mode === 'amc_exam_mode') return 'amc_exam';
  // Only explicit mode labels are safe. Generic/legacy session types such as
  // pie_adaptive can contain Nudge in config.mode, and legacy_orphan has no
  // reliable mode provenance, so neither may be silently classified as Normal MCQ.
  if (mode === 'normal' || mode === 'normal_mcq') return 'normal_mcq';
  return null;
}
export type EvidenceRead<T> = { status: 'ready'; value: T } | { status: 'empty' | 'unavailable'; value: null };
export interface DimensionEvidence {
  uncertainty: number | null;
  lower: number | null;
  upper: number | null;
  evidenceCount: number | null;
  evidenceQuality: number | null;
  estimateAligned?: boolean | null;
  calibrationReady?: boolean | null;
  confidenceLevelCounts?: Record<string, number | null> | null;
}
export interface ModeDimensionEvidence extends DimensionEvidence {
  estimate: number | null;
}
export interface StateEvidence {
  dimensions: Record<Dimension, number | null>;
  dimensionEvidence?: Record<Dimension, DimensionEvidence>;
  modeEvidence?: Record<PracticeMode, Record<Dimension, ModeDimensionEvidence>>;
  count: number | null;
  level: string;
  timestamp: string | null;
  sufficient: boolean;
  sessionMode?: string | null;
}
export interface SafeAttempt {
  id: string; subjectId: string | null; subject: string; correct: boolean; answerKeyAvailable?: boolean;
  confidence: number | null; seconds: number | null; changes: number | null; at: string; sessionMode?: string | null;
}
export interface ActionEvidence { title: string; reason: string; subjectId: string | null; at: string | null; sessionMode?: string | null; }
export interface IntelligenceEvidence {
  pie: EvidenceRead<StateEvidence>;
  history: EvidenceRead<SafeAttempt[]>;
  stability: EvidenceRead<{ percent: number; at: string | null; sessionMode?: string | null }>;
  confidence: EvidenceRead<{ percent: number; at: string | null; sessionMode?: string | null }>;
  action: EvidenceRead<ActionEvidence>;
}
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function fraction(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}
function percentage(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
function timestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}
function dimensionCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
export function mapState(value: unknown): StateEvidence | null {
  const row = object(value), state = object(row.state);
  if (!Object.keys(state).length) return null;
  const dimensions = Object.fromEntries(DIMENSIONS.map(key => [key, fraction(object(state[key]).estimate)])) as Record<Dimension, number | null>;
  const dimensionEvidence = Object.fromEntries(DIMENSIONS.map(key => {
    const raw = object(state[key]);
    return [key, {
      uncertainty: fraction(raw.uncertainty),
      lower: fraction(raw.lower),
      upper: fraction(raw.upper),
      evidenceCount: dimensionCount(raw.evidence_count),
      evidenceQuality: fraction(raw.evidence_quality),
      estimateAligned: typeof raw.estimate_aligned === 'boolean' ? raw.estimate_aligned : null,
      calibrationReady: typeof raw.calibration_ready === 'boolean' ? raw.calibration_ready : null,
      confidenceLevelCounts: Object.keys(object(raw.confidence_level_counts)).length
        ? Object.fromEntries([1,2,3,4,5].map(level => [String(level), dimensionCount(object(raw.confidence_level_counts)[String(level)])]))
        : null,
    }];
  })) as Record<Dimension, DimensionEvidence>;
  const rawModeEvidence = object(state.mode_evidence);
  const modeEvidence = Object.keys(rawModeEvidence).length
    ? Object.fromEntries((['normal_mcq','amc_exam','nudge'] as const).map(mode => {
        const modeState = object(rawModeEvidence[mode]);
        const modeDimensions = Object.fromEntries(DIMENSIONS.map(key => {
          const raw = object(modeState[key]);
          const confidenceLevels = object(raw.confidence_level_counts);
          return [key, {
            estimate: fraction(raw.estimate),
            uncertainty: fraction(raw.uncertainty),
            lower: fraction(raw.lower),
            upper: fraction(raw.upper),
            evidenceCount: dimensionCount(raw.evidence_count),
            evidenceQuality: fraction(raw.evidence_quality),
            estimateAligned: typeof raw.estimate_aligned === 'boolean' ? raw.estimate_aligned : null,
            calibrationReady: typeof raw.calibration_ready === 'boolean' ? raw.calibration_ready : null,
            confidenceLevelCounts: Object.keys(confidenceLevels).length
              ? Object.fromEntries([1,2,3,4,5].map(level => [String(level), dimensionCount(confidenceLevels[String(level)])]))
              : null,
          }];
        })) as Record<Dimension, ModeDimensionEvidence>;
        return [mode, modeDimensions];
      })) as Record<PracticeMode, Record<Dimension, ModeDimensionEvidence>>
    : undefined;
  const count = typeof state.evidence_count === 'number' && Number.isSafeInteger(state.evidence_count) && state.evidence_count >= 0 ? state.evidence_count : null;
  const level = typeof state.evidence_level === 'string' ? state.evidence_level : 'INSUFFICIENT';
  return { dimensions, dimensionEvidence, modeEvidence, count, level, timestamp: timestamp(row.calculated_at ?? row.updated_at), sufficient: count !== null && count >= PIE_MIN_OBSERVATIONS && level !== 'INSUFFICIENT',
    // The current authoritative projection has no declared practice-mode scope.
    sessionMode: typeof state.session_mode === 'string' ? state.session_mode : null };
}
export function safeAttempt(row: PieHistoryRow): SafeAttempt {
  return { id: row.attempt_id, subjectId: row.subject_id, subject: row.subject_name ?? 'Uncategorised', correct: row.is_correct, answerKeyAvailable: typeof row.correct_answer === 'string' && row.correct_answer.trim().length > 0, 
    confidence: typeof row.confidence_level === 'number' && Number.isSafeInteger(row.confidence_level) && row.confidence_level >= 1 && row.confidence_level <= 5 ? row.confidence_level : null,
    seconds: typeof row.time_taken_seconds === 'number' && Number.isFinite(row.time_taken_seconds) && row.time_taken_seconds >= 0 ? row.time_taken_seconds : null,
    changes: typeof row.answer_changes_count === 'number' && Number.isSafeInteger(row.answer_changes_count) && row.answer_changes_count >= 0 ? row.answer_changes_count : null,
    at: row.created_at, sessionMode: row.session_mode ?? null };
}
export function historySummary(rows: SafeAttempt[]) {
  const unique = [...new Map(rows.map(row => [row.id, row])).values()];
  const scored = unique.filter(row => row.answerKeyAvailable === true);
  const confidenceRows = scored.filter(row => row.confidence !== null);
  const timed = unique.filter(row => row.seconds !== null);
  return { rows: unique, count: unique.length, scoredCount: scored.length, accuracy: scored.length ? scored.filter(row => row.correct).length / scored.length * 100 : null,
    confidenceCount: confidenceRows.length, changeEvidenceCount: unique.filter(row => row.changes !== null).length,
    changed: unique.filter(row => row.changes !== null && row.changes > 0).length,
    highConfidenceErrors: confidenceRows.filter(row => Number(row.confidence) >= 4 && !row.correct).length,
    lowConfidenceCorrect: confidenceRows.filter(row => Number(row.confidence) <= 2 && row.correct).length,
    meanSeconds: timed.length ? timed.reduce((sum, row) => sum + Number(row.seconds), 0) / timed.length : null,
    timedCount: timed.length };
}
export function mapAction(value: unknown, now = Date.now()): ActionEvidence | null {
  const row = object(value), data = object(row.action_data);
  if (row.expires_at != null && (!timestamp(row.expires_at) || Date.parse(String(row.expires_at)) <= now)) return null;
  // Only the existing supported action is named; unknown contracts are not invented.
  if (row.action_type !== 'FOCUS_WEAK_SUBJECT' || typeof data.reason !== 'string' || !data.reason) return null;
  return { title: 'Review your lowest-performing subject', reason: data.reason, subjectId: typeof data.subject_id === 'string' ? data.subject_id : null, at: timestamp(row.updated_at ?? row.created_at),
    sessionMode: typeof data.session_mode === 'string' ? data.session_mode : null };
}
export interface EvidenceDeps { ensure: () => Promise<void>; read: (name: string, columns: string) => Promise<{ data: unknown; error: unknown }>; history: () => Promise<PieHistoryRow[]>; }
const defaultDeps: EvidenceDeps = {
  ensure: ensureV2Session,
  read: async (name, columns) => { const result = await getSupabaseV2().from(name).select(columns).limit(1).maybeSingle(); return result; },
  history: () => fetchPieAttemptHistory(2000),
};
async function read<T>(work: () => Promise<T | null>): Promise<EvidenceRead<T>> {
  try { const value = await work(); return value === null ? { status: 'empty', value: null } : { status: 'ready', value }; }
  catch { return { status: 'unavailable', value: null }; }
}
export async function loadIntelligenceEvidence(deps: EvidenceDeps = defaultDeps): Promise<IntelligenceEvidence> {
  const unavailable = { status: 'unavailable', value: null } as const;
  try { await deps.ensure(); } catch { return { pie: unavailable, history: unavailable, stability: unavailable, confidence: unavailable, action: unavailable }; }
  const row = async (name: string, columns: string) => { const result = await deps.read(name, columns); if (result.error) throw new Error('Evidence unavailable'); return result.data; };
  const [pie, history, stability, confidence, action] = await Promise.all([
    read(async () => mapState(await row('my_pie_state', 'state,calculated_at,updated_at'))),
    read(async () => (await deps.history()).map(safeAttempt)),
    read(async () => { const data = object(await row('my_readiness', 'dimensions,calculated_at')); const percent = percentage(object(data.dimensions).answer_stability); return percent === null ? null : { percent, at: timestamp(data.calculated_at) }; }),
    read(async () => { const data = object(await row('my_confidence_intelligence', 'calibration_score,calculated_at')); const score = fraction(data.calibration_score); return score === null ? null : { percent: score * 100, at: timestamp(data.calculated_at), sessionMode: null }; }),
    read(async () => mapAction(await row('my_next_best_actions', 'action_type,action_data,expires_at,created_at,updated_at'))),
  ]);
  return { pie, history, stability, confidence, action };
}