import { ensureV2Session } from "@/lib/migration/v2-practice-session";
import { getSupabaseV2 } from "@/integrations/supabase/v2-client";
import { validateP13ShadowPayload, type P13ShadowView } from "./p13-shadow-client";

export async function loadP14ShadowInference(): Promise<P13ShadowView> {
  try {
    await ensureV2Session();
    const client = getSupabaseV2();
    const { data, error } = await client.functions.invoke("pie-p14-shadow-read", { body: {} });

    if (error) {
      return { status: "unavailable", message: error.message || "PIE shadow inference is unavailable." };
    }
    if (!data || data.status === "no_inference") {
      return { status: "empty", reason: "no_inference" };
    }

    const inference = validateP13ShadowPayload(data);
    if (inference.status !== "ready") {
      const counts = inference.dimensions.map((d) => d.evidence_count ?? 0);
      const maxEvidence = counts.length ? Math.max(...counts) : 0;
      return {
        status: "empty",
        reason: maxEvidence < 6 ? "insufficient_evidence" : "incomplete_evidence",
      };
    }

    return { status: "ready", inference };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "PIE shadow inference is unavailable.",
    };
  }
}
