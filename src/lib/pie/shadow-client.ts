import { ensureV2Session } from "@/lib/migration/v2-practice-session";
import { getSupabaseV2 } from "@/integrations/supabase/v2-client";
import { loadPieView, syncPieState, type PieClient, type PieDeps, type PieSyncResult, type PieView } from "@/lib/pie/pie-state";

/**
 * Production PIE client (file name retained for import stability; this is not shadow mode).
 *
 * V2 Practice records authoritative attempts into pie.pie_observation inside the
 * server-authoritative save_attempt RPC. These helpers only rebuild/read the caller's
 * own V2 PIE state via the authenticated public wrapper; they never supply correctness.
 */
const productionDeps: PieDeps = {
  ensureSession: ensureV2Session,
  getClient: () => getSupabaseV2() as unknown as PieClient,
};

export function syncPieEngine(): Promise<PieSyncResult> {
  return syncPieState(productionDeps);
}

export function loadPieEngineView(): Promise<PieView> {
  return loadPieView(productionDeps);
}
