import { ensureV2Session } from '@/lib/migration/v2-practice-session';
import { getSupabaseV2 } from '@/integrations/supabase/v2-client';
import { fetchPieAttemptHistory, type PieHistoryRow } from './pie-history-client';
import { PIE_MIN_OBSERVATIONS } from './pie-state';

export const DIMENSIONS = ['capability', 'decision', 'timing', 'calibration', 'sustained_performance', 'learning'] as const;
export type Dimension = typeof DIMENSIONS[number];
export type EvidenceRead<T> = { status: 'ready'; value: T } | { status: 'empty' | 'unavailable'; value: null };
export interface DimensionEvidence {
  uncertainty: number | null;
  lower: number | null;
  upper: number | null;
  evidenceCount: number | null;
  evidenceQuality: number | null;
  estimateAligned?: boolean | null;
}
export interface StateEvidence {
  dimensions: Record<Dimension, number | null>;
  dimensionEvidence?: Record<Dimension, DimensionEvidence>;
  count: number;
  level: string;
  timestamp: string | null;
  sufficient: boolean;
}
export interface SafeAttempt {
  id: string; subjectId: string | null; subject: string; correct: boolean;
  confidence: number | null; seconds: number | null; changes: number; at: string;
}
export interface ActionEvidence { title: string; reason: string; subjectId: string | null; at: string | null; }
export interface IntelligenceEvidence {
  pie: EvidenceRead<StateEvidence>;
  history: EvidenceRead<SafeAttempt[]>;
  stability: EvidenceRead<{ percent: number; at: string | null }>;
  confidence: EvidenceRead<{ percent: number; at: string | null }>;
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
    }];
  })) as Record<Dimension, DimensionEvidence>;
  const count = typeof state.evidence_count === 'number' && Number.isFinite(state.evidence_count) ? Math.max(0, Math.floor(state.evidence_count)) : 0;
  const level = typeof state.evidence_level === 'string' ? state.evidence_level : 'INSUFFICIENT';
  const required = ['capability', 'decision', 'timing', 'calibration', 'sustained_performance', 'learning'] as const;
  const dimensionMinimum = PIE_MIN_OBSERVATIONS;
  const dimensionEvidenceSufficient = required.every(key => {
    const item = dimensionEvidence[key];
    return item.evidenceCount !== null && item.evidenceCount >= dimensionMinimum && dimensions[key] !== null;
  });
  return { dimensions, dimensionEvidence, count, level, timestamp: timestamp(row.calculated_at ?? row.updated_at), sufficient: count >= PIE_MIN_OBSERVATIONS && level !== 'INSUFFICIENT' && dimensionEvidenceSufficient };
}
export function safeAttempt(row: PieHistoryRow): SafeAttempt {
  return { id: row.attempt_id, subjectId: row.subject_id, subject: row.subject_name ?? 'Uncategorised', correct: row.is_correct,
    confidence: typeof row.confidence_level === 'number' && row.confidence_level >= 1 && row.confidence_level <= 5 ? row.confidence_level : null,
    seconds: typeof row.time_taken_seconds === 'number' && row.time_taken_seconds >= 0 ? row.time_taken_seconds : null,
    changes: row.answer_changes_count ?? 0, at: row.created_at };
}
export function historySummary(rows: SafeAttempt[]) {
  const unique = [...new Map(rows.map(row => [row.id, row])).values()];
  const confidenceRows = unique.filter(row => row.confidence !== null);
  const timed = unique.filter(row => row.seconds !== null);
  return { rows: unique, count: unique.length, accuracy: unique.length ? unique.filter(row => row.correct).length / unique.length * 100 : null,
    confidenceCount: confidenceRows.length, changed: unique.filter(row => row.changes > 0).length,
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
  return { title: 'Review your lowest-performing subject', reason: data.reason, subjectId: typeof data.subject_id === 'string' ? data.subject_id : null, at: timestamp(row.updated_at ?? row.created_at) };
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
    read(async () => { const data = object(await row('my_confidence_intelligence', 'calibration_score,calculated_at')); const score = fraction(data.calibration_score); return score === null ? null : { percent: score * 100, at: timestamp(data.calculated_at) }; }),
    read(async () => mapAction(await row('my_next_best_actions', 'action_type,action_data,expires_at,created_at,updated_at'))),
  ]);
  return { pie, history, stability, confidence, action };
}