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
  state_sequence: number;
  capability: number;
  decision: number;
  timing: number;
  calibration: number;
  sustained_performance: number;
  learning: number;
  identification_status: string;
  evidence_level: string;
  data_quality: number;
  observation_count: number;
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
  | { status: 'building'; observations: number; pie: PieState | null }
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

function clamp01(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
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
  const estimate = (dimension: string) => {
    const value = state[dimension];
    return clamp01(value && typeof value === 'object' ? (value as { estimate?: unknown }).estimate : undefined);
  };
  const evidenceLevel = typeof state.evidence_level === 'string' && state.evidence_level
    ? state.evidence_level
    : 'INSUFFICIENT';
  const observations = Math.max(0, Math.floor(Number(state.evidence_count ?? 0)) || 0);

  return {
    state_timestamp: row.calculated_at ?? row.updated_at ?? null,
    state_sequence: Number(row.state_version ?? 0) || 0,
    capability: estimate('capability'),
    decision: estimate('decision'),
    timing: estimate('timing'),
    calibration: estimate('calibration'),
    sustained_performance: estimate('sustained_performance'),
    learning: estimate('learning'),
    identification_status: evidenceLevel === 'INSUFFICIENT' || observations < PIE_MIN_OBSERVATIONS
      ? 'BUILDING_EVIDENCE'
      : 'IDENTIFIED',
    evidence_level: evidenceLevel,
    data_quality: clamp01(row.confidence),
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
  if (!pie) return { status: 'building', observations: 0, pie: null };
  if (pie.observation_count < PIE_MIN_OBSERVATIONS || pie.evidence_level === 'INSUFFICIENT') {
    return { status: 'building', observations: pie.observation_count, pie };
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
      detail: `${view.observations} of ${PIE_MIN_OBSERVATIONS} observations needed`,
    };
  }
  return {
    tone: 'unavailable',
    headline: 'PIE temporarily unavailable',
    detail: 'Your practice data is safe. Please try again shortly.',
  };
}
