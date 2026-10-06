import { ensureV2Session } from "@/lib/migration/v2-practice-session";
import { getSupabaseV2 } from "@/integrations/supabase/v2-client";

/**
 * Production PIE refresh.
 *
 * V2 Practice already records authoritative attempts into pie.pie_observation
 * inside the server-authoritative save_attempt RPC. This client function only
 * refreshes the V2 intelligence state; it never supplies or computes correctness.
 */
export async function syncPieEngine(): Promise<void> {
  try {
    await ensureV2Session();

    const v2 = getSupabaseV2();
    const { data: session } = await v2.auth.getSession();
    const v2UserId = session.session?.user?.id;

    if (!v2UserId) {
      console.warn("[PIE] V2 session unavailable");
      return;
    }

    const { error: refreshError } = await v2.rpc("refresh_candidate_intelligence");
    if (refreshError) {
      console.warn("[PIE] V2 intelligence refresh failed", refreshError);
    }

    const { error: pieError } = await v2
      .schema("pie")
      .rpc("rebuild_candidate_state", { p_user_id: v2UserId });

    if (pieError) {
      console.warn("[PIE] V2 candidate-state rebuild failed", pieError);
    }
  } catch (error) {
    // PIE is downstream intelligence. It must never block Practice answer persistence.
    console.warn("[PIE] V2 refresh failed", error);
  }
}
