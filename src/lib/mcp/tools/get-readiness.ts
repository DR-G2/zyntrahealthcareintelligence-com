import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_readiness",
  title: "Get exam readiness",
  description:
    "Get the signed-in candidate's readiness scores: clinical accuracy, time management, answer stability, confidence calibration and overall readiness.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId() ?? "";

    const [dnaRes, perfRes] = await Promise.all([
      supabase
        .from("readiness_dna")
        .select(
          "readiness_score, clinical_accuracy, time_management, answer_stability, confidence_calibration, distance_from_ideal, attempt_count, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("performance_profiles")
        .select("readiness_score, clinical_accuracy, stability_score, time_sensitivity, confidence_gap, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (dnaRes.error) throw new ToolError(dnaRes.error.message);
    if (perfRes.error) throw new ToolError(perfRes.error.message);

    const readiness = {
      readinessScore: dnaRes.data?.readiness_score ?? perfRes.data?.readiness_score ?? null,
      clinicalAccuracy: dnaRes.data?.clinical_accuracy ?? perfRes.data?.clinical_accuracy ?? null,
      timeManagement: dnaRes.data?.time_management ?? null,
      answerStability: dnaRes.data?.answer_stability ?? perfRes.data?.stability_score ?? null,
      confidenceCalibration: dnaRes.data?.confidence_calibration ?? null,
      confidenceGap: perfRes.data?.confidence_gap ?? null,
      distanceFromIdeal: dnaRes.data?.distance_from_ideal ?? null,
      attemptCount: dnaRes.data?.attempt_count ?? null,
      updatedAt: dnaRes.data?.updated_at ?? perfRes.data?.updated_at ?? null,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(readiness, null, 2) }],
      structuredContent: { readiness },
    };
  },
});
