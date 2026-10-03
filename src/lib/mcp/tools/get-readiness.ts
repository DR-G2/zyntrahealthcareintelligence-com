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

    const { data, error } = await supabase
      .from("readiness_dna")
      .select(
        "readiness_score, clinical_accuracy, time_management, answer_stability, confidence_calibration, distance_from_ideal, attempt_count, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new ToolError(error.message);

    const readiness = {
      readinessScore: data?.readiness_score ?? null,
      clinicalAccuracy: data?.clinical_accuracy ?? null,
      timeManagement: data?.time_management ?? null,
      answerStability: data?.answer_stability ?? null,
      confidenceCalibration: data?.confidence_calibration ?? null,
      confidenceGap: null,
      distanceFromIdeal: data?.distance_from_ideal ?? null,
      attemptCount: data?.attempt_count ?? null,
      updatedAt: data?.updated_at ?? null,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(readiness, null, 2) }],
      structuredContent: { readiness },
    };
  },
});
