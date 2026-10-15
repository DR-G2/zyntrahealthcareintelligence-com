import { describe, expect, it } from 'vitest';
import { mapState, mapAction, historySummary, loadIntelligenceEvidence, type SafeAttempt } from './intelligence-evidence';

describe('Intelligence evidence presentation boundary', () => {
  it('preserves missing or invalid dimensions rather than inventing zero', () => {
    const result = mapState({ state: { capability: { estimate: 0 }, decision: { estimate: 2 }, evidence_count: 6, evidence_level: 'PRELIMINARY' } });
    expect(result?.dimensions.capability).toBe(0);
    expect(result?.dimensions.decision).toBeNull();
    expect(result?.dimensions.timing).toBeNull();
  });
  it('requires six observations and non-insufficient evidence', () => {
    expect(mapState({ state: { evidence_count: 5, evidence_level: 'PRELIMINARY' } })?.sufficient).toBe(false);
    expect(mapState({ state: { evidence_count: 6, evidence_level: 'INSUFFICIENT' } })?.sufficient).toBe(false);
    expect(mapState({ state: { evidence_count: 6, evidence_level: 'PRELIMINARY' } })?.sufficient).toBe(true);
  });
  it('keeps no attempts distinct from true zero accuracy and deduplicates identities', () => {
    expect(historySummary([]).accuracy).toBeNull();
    const row: SafeAttempt = { id: 'a', subjectId: 's', subject: 'Medicine', correct: false, confidence: null, seconds: null, changes: 0, at: '' };
    expect(historySummary([row, row])).toMatchObject({ count: 1, accuracy: 0, confidenceCount: 0, meanSeconds: null });
  });
  it('does not invent actions or display expired recommendations', () => {
    expect(mapAction({ action_type: 'NEW_UNKNOWN_MODE', action_data: { reason: 'test' } })).toBeNull();
    expect(mapAction({ action_type: 'FOCUS_WEAK_SUBJECT', action_data: { reason: 'test' }, expires_at: '2026-01-01' }, Date.parse('2026-10-15'))).toBeNull();
  });
  it('uses only existing read projections and exposes read failures distinctly', async () => {
    const names: string[] = [];
    const result = await loadIntelligenceEvidence({ ensure: async () => {}, history: async () => [], read: async (name) => { names.push(name); return { data: null, error: name === 'my_pie_state' ? 'denied' : null }; } });
    expect(names.sort()).toEqual(['my_confidence_intelligence', 'my_next_best_actions', 'my_pie_state', 'my_readiness']);
    expect(result.pie.status).toBe('unavailable');
    expect(result.history).toEqual({ status: 'ready', value: [] });
    expect(result.stability.status).toBe('empty');
  });
});