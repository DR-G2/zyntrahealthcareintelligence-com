import { ensureV2Session } from "@/lib/migration/v2-practice-session";
import { getSupabaseV2 } from "@/integrations/supabase/v2-client";

export const P13_SHADOW_DIMENSIONS = [
  "capability",
  "decision",
  "timing",
  "calibration",
  "sustained_performance",
  "learning",
] as const;

export type P13ShadowDimensionName = typeof P13_SHADOW_DIMENSIONS[number];

export interface P13ShadowDimension {
  dimension: P13ShadowDimensionName;
  estimate: number | null;
  uncertainty: number | null;
  lower: number | null;
  upper: number | null;
  evidence_count: number | null;
  evidence_quality: number | null;
}

export interface P13ShadowInference {
  status: "ready" | "no_inference" | "incomplete";
  shadow_only: true;
  authoritative: false;
  influences_adaptation: false;
  model_version: string | null;
  source_state_version: number | null;
  evidence_maturity: string | null;
  signal_quality: string | null;
  explanation: Record<string, unknown> | null;
  inference_hash: string | null;
  inferred_at: string | null;
  dimensions: P13ShadowDimension[];
}

export type P13ShadowView =
  | { status: "loading" }
  | { status: "ready"; inference: P13ShadowInference }
  | { status: "empty"; reason: "no_inference" | "insufficient_evidence" | "incomplete_evidence" }
  | { status: "unavailable"; message: string };

export function validateP13ShadowPayload(payload: unknown): P13ShadowInference {
  if (!payload || typeof payload !== "object") throw new Error("Invalid P13 shadow response");
  const value = payload as Record<string, unknown>;
  if (value.shadow_only !== true || value.authoritative !== false || value.influences_adaptation !== false) {
    throw new Error("P13 shadow response failed isolation contract");
  }

  const raw = Array.isArray(value.dimensions) ? value.dimensions : [];
  const dimensions = raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      dimension: String(item.dimension) as P13ShadowDimensionName,
      estimate: typeof item.estimate === "number" ? item.estimate : null,
      uncertainty: typeof item.uncertainty === "number" ? item.uncertainty : null,
      lower: typeof item.lower === "number" ? item.lower : null,
      upper: typeof item.upper === "number" ? item.upper : null,
      evidence_count: typeof item.evidence_count === "number" ? item.evidence_count : null,
      evidence_quality: typeof item.evidence_quality === "number" ? item.evidence_quality : null,
    }))
    .filter((item) => (P13_SHADOW_DIMENSIONS as readonly string[]).includes(item.dimension));

  const unique = P13_SHADOW_DIMENSIONS.map((name) => dimensions.find((item) => item.dimension === name)).filter(Boolean) as P13ShadowDimension[];
  const complete = unique.length === P13_SHADOW_DIMENSIONS.length && unique.every((item) =>
    [item.estimate, item.uncertainty, item.lower, item.upper, item.evidence_count, item.evidence_quality]
      .every((n) => typeof n === "number" && Number.isFinite(n))
  );

  return {
    status: complete ? "ready" : "incomplete",
    shadow_only: true,
    authoritative: false,
    influences_adaptation: false,
    model_version: typeof value.model_version === "string" ? value.model_version : null,
    source_state_version: typeof value.source_state_version === "number" ? value.source_state_version : null,
    evidence_maturity: typeof value.evidence_maturity === "string" ? value.evidence_maturity : null,
    signal_quality: typeof value.signal_quality === "string" ? value.signal_quality : null,
    explanation: value.explanation && typeof value.explanation === "object" ? value.explanation as Record<string, unknown> : null,
    inference_hash: typeof value.inference_hash === "string" ? value.inference_hash : null,
    inferred_at: typeof value.inferred_at === "string" ? value.inferred_at : null,
    dimensions: unique,
  };
}

export async function loadP13ShadowInference(): Promise<P13ShadowView> {
  try {
    await ensureV2Session();
    const client = getSupabaseV2();
    const { data, error } = await client.functions.invoke("pie-shadow-read", { body: {} });

    if (error) {
      return { status: "unavailable", message: error.message || "PIE shadow inference is unavailable." };
    }
    if (!data || data.status === "no_inference") return { status: "empty", reason: "no_inference" };

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
