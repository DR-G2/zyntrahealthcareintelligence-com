/**
 * Production PIE state boundary (V2 Supabase).
 *
 * Pipeline: Practice save_attempt (server-authoritative) -> pie.pie_observation
 *   -> public.rebuild_candidate_state(uuid) (authenticated wrapper, auth.uid() = p_user_id)
 *   -> pie.pie_candidate_state -> public.my_pie_state -> Performance Intelligence UI.
 *
 * Browsers never call into the internal `pie` schema directly and never supply
 * correctness. Every failure is surfaced as an explicit "unavailable" state with a
 * diagnostic instead of being collapsed into "no state yet".
 */

export const PIE_MIN_OBSERVATIONS = 6;

export interface PieState {
  state_timestamp: string | null;
  state_sequence: number | null;
  capability: number | null;
  decision: number | null;
  timing: number | null;
  calibration: number | null;
  sustained_performance: number | null;
  learning: number | null;
  identification_status: string;
  evidence_level: string;
  data_quality: number | null;
  observation_count: number | null;
  model_version: string;
}

export interface PieStateRow {
  state_version?: number | null;
  state?: unknown;
  confidence?: number | string | null;
  calculated_at?: string | null;
  updated_at?: string | null;
}

export type PieStage = 'config' | 'session' | 'rebuild' | 'read';

export interface PieDiagnostic {
  stage: PieStage;
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
}

export type PieView =
  | { status: 'building'; observations: number | null; pie: PieState | null }
  | { status: 'ready'; pie: PieState }
  | { status: 'unavailable'; diagnostic: PieDiagnostic };

interface RpcResult<T = unknown> {
  data: T | null;
  error: { message?: string; code?: string; details?: string; hint?: string } | null;
}

/** Minimal structural view of the V2 Supabase client used by PIE. */
export interface PieClient {
  auth: {
    getSession(): Promise<{ data: { session: { user?: { id?: string | null } | null } | null } }>;
  };
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
  from(relation: string): {
    select(columns: string): { maybeSingle(): PromiseLike<RpcResult<PieStateRow>> };
  };
}

export interface PieDeps {
  ensureSession: () => Promise<void>;
  getClient: () => PieClient;
}

function validFraction(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function validCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function toPieDiagnostic(stage: PieStage, error: unknown): PieDiagnostic {
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    return {
      stage,
      message: typeof e.message === 'string' && e.message ? e.message : String(error),
      code: typeof e.code === 'string' ? e.code : null,
      details: typeof e.details === 'string' ? e.details : null,
      hint: typeof e.hint === 'string' ? e.hint : null,
    };
  }
  return { stage, message: typeof error === 'string' ? error : 'Unknown PIE failure', code: null };
}

function unavailable(diagnostic: PieDiagnostic): PieView {
  // Useful, structured diagnostics for support without leaking anything to the UI.
  console.error('[PIE] temporarily unavailable', diagnostic);
  return { status: 'unavailable', diagnostic };
}

/** Maps a public.my_pie_state row to the UI model. Returns null for an unusable row. */
export function mapPieStateRow(row: PieStateRow | null | undefined): PieState | null {
  if (!row || !row.state || typeof row.state !== 'object') return null;
  const state = row.state as Record<string, unknown>;
  const estimate = (dimension: string): number | null => {
    const value = state[dimension];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return validFraction((value as { estimate?: unknown }).estimate);
  };
  const evidenceLevel = typeof state.evidence_level === 'string' && state.evidence_level
    ? state.evidence_level
    : 'INSUFFICIENT';
  const observations = validCount(state.evidence_count);
  const dimensions = [
    estimate('capability'), estimate('decision'), estimate('timing'),
    estimate('calibration'), estimate('sustained_performance'), estimate('learning'),
  ];

  return {
    state_timestamp: typeof row.calculated_at === 'string' ? row.calculated_at : typeof row.updated_at === 'string' ? row.updated_at : null,
    state_sequence: validCount(row.state_version),
    capability: dimensions[0],
    decision: dimensions[1],
    timing: dimensions[2],
    calibration: dimensions[3],
    sustained_performance: dimensions[4],
    learning: dimensions[5],
    identification_status: evidenceLevel === 'INSUFFICIENT' || observations === null || observations < PIE_MIN_OBSERVATIONS
      ? 'BUILDING_EVIDENCE'
      : dimensions.some(value => value === null) ? 'STATE_INCOMPLETE' : 'IDENTIFIED',
    evidence_level: evidenceLevel,
    data_quality: validFraction(typeof row.confidence === 'number' ? row.confidence : null),
    observation_count: observations,
    model_version: 'v2-candidate-state',
  };
}

/**
 * UI state mapping for a successfully read row (or no row):
 *   no row / 0 observations / < 6 observations / INSUFFICIENT -> building
 *   otherwise                                                 -> ready
 * Backend failures never reach this function; they are "unavailable".
 */
export function resolvePieView(row: PieStateRow | null | undefined): PieView {
  const pie = mapPieStateRow(row);
  if (!pie) return { status: 'building', observations: null, pie: null };
  if (pie.observation_count === null) {
    return { status: 'unavailable', diagnostic: { stage: 'read', message: 'PIE observation count is missing or invalid.' } };
  }
  if (pie.observation_count < PIE_MIN_OBSERVATIONS || pie.evidence_level === 'INSUFFICIENT') {
    return { status: 'building', observations: pie.observation_count, pie };
  }
  if ([pie.capability, pie.decision, pie.timing, pie.calibration, pie.sustained_performance, pie.learning].some(value => value === null)) {
    return { status: 'unavailable', diagnostic: { stage: 'read', message: 'One or more PIE dimension estimates are missing or invalid.' } };
  }
  return { status: 'ready', pie };
}

async function resolveClientAndUser(deps: PieDeps): Promise<{ client: PieClient; userId: string } | PieDiagnostic> {
  let client: PieClient;
  try {
    client = deps.getClient();
  } catch (error) {
    return toPieDiagnostic('config', error);
  }

  try {
    await deps.ensureSession();
  } catch (error) {
    return toPieDiagnostic('session', error);
  }

  const { data } = await client.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return { stage: 'session', message: 'V2 session unavailable after authentication bridge.' };
  return { client, userId };
}

/** Rebuilds the caller's own candidate state through the authenticated public wrapper. */
export function rebuildOwnPieState(client: PieClient, userId: string) {
  return client.rpc('rebuild_candidate_state', { p_user_id: userId });
}

/** Best-effort refresh of canonical (non-PIE) intelligence. Never affects PIE status. */
async function refreshCanonicalIntelligence(client: PieClient): Promise<void> {
  try {
    const { error } = await client.rpc('refresh_candidate_intelligence');
    if (error) console.warn('[PIE] canonical intelligence refresh failed (non-blocking)', toPieDiagnostic('rebuild', error));
  } catch (error) {
    console.warn('[PIE] canonical intelligence refresh failed (non-blocking)', toPieDiagnostic('rebuild', error));
  }
}

/** Loads the learner's PIE view for the Performance Intelligence page. Never throws. */
export async function loadPieView(deps: PieDeps): Promise<PieView> {
  try {
    const resolved = await resolveClientAndUser(deps);
    if ('stage' in resolved) return unavailable(resolved);
    const { client, userId } = resolved;

    await refreshCanonicalIntelligence(client);

    const { error: rebuildError } = await rebuildOwnPieState(client, userId);
    if (rebuildError) return unavailable(toPieDiagnostic('rebuild', rebuildError));

    const { data: row, error: readError } = await client
      .from('my_pie_state')
      .select('state_version, state, confidence, calculated_at, updated_at')
      .maybeSingle();
    if (readError) return unavailable(toPieDiagnostic('read', readError));

    return resolvePieView(row);
  } catch (error) {
    return unavailable(toPieDiagnostic('read', error));
  }
}

export type PieSyncResult = { ok: true } | { ok: false; diagnostic: PieDiagnostic };

/**
 * Post-attempt PIE refresh. Practice/Assess persistence has already succeeded when this
 * runs; PIE is downstream and must never block or fail answer persistence. Never throws.
 */
export async function syncPieState(deps: PieDeps): Promise<PieSyncResult> {
  try {
    const resolved = await resolveClientAndUser(deps);
    if ('stage' in resolved) {
      console.warn('[PIE] sync skipped', resolved);
      return { ok: false, diagnostic: resolved };
    }
    const { client, userId } = resolved;

    await refreshCanonicalIntelligence(client);

    const { error } = await rebuildOwnPieState(client, userId);
    if (error) {
      const diagnostic = toPieDiagnostic('rebuild', error);
      console.warn('[PIE] candidate-state rebuild failed', diagnostic);
      return { ok: false, diagnostic };
    }
    return { ok: true };
  } catch (error) {
    const diagnostic = toPieDiagnostic('rebuild', error);
    console.warn('[PIE] sync failed', diagnostic);
    return { ok: false, diagnostic };
  }
}

export interface PieStatusCopy {
  tone: 'loading' | 'ready' | 'building' | 'unavailable';
  headline: string;
  detail: string;
}

/** Header copy for the PIE panel. "Awaiting signal" is intentionally never used. */
export function describePieStatus(view: PieView | null, loading: boolean): PieStatusCopy {
  if (loading || !view) {
    return { tone: 'loading', headline: 'Loading PIE state', detail: 'Refreshing your PIE candidate state' };
  }
  if (view.status === 'ready') {
    return {
      tone: 'ready',
      headline: view.pie.identification_status.replace(/_/g, ' '),
      detail: `Evidence: ${view.pie.evidence_level.replace(/_/g, ' ')}`,
    };
  }
  if (view.status === 'building') {
    return {
      tone: 'building',
      headline: 'Building evidence',
      detail: view.observations === null
        ? 'Observation count unavailable; no score is inferred.'
        : `${view.observations} of ${PIE_MIN_OBSERVATIONS} observations needed`,
    };
  }
  return {
    tone: 'unavailable',
    headline: 'PIE temporarily unavailable',
    detail: 'Your practice data is safe. Please try again shortly.',
  };
}
