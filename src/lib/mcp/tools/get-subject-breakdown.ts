import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { paidRpcErrorMessage, supabaseV2ForUser } from "../supabase";

export default defineTool({
  name: "get_subject_breakdown",
  title: "Get subject-by-subject accuracy",
  description:
    "Summarise the signed-in candidate's MCQ accuracy and average answer time per AMC subject, weakest subject first (paid plans).",
  inputSchema: {
    sample_size: z
      .number()
      .int()
      .min(20)
      .max(1000)
      .default(400)
      .describe("How many of the most recent attempts to analyse."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ sample_size }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    // Paid only: 0086 get_my_attempt_summary (no question content). Non-paid -> generic paywall error.
    const supabase = supabaseV2ForUser(ctx);
    const { data, error } = await supabase.rpc("get_my_attempt_summary", { p_limit: sample_size });
    if (error) throw new ToolError(paidRpcErrorMessage(error, "Subject breakdown"));

    const buckets = new Map<string, { attempts: number; correct: number; totalTime: number }>();
    for (const row of (data ?? []) as { subject_name: string | null; is_correct: boolean; time_taken_seconds: number | null }[]) {
      const subject = row.subject_name ?? "Unclassified";
      const bucket = buckets.get(subject) ?? { attempts: 0, correct: 0, totalTime: 0 };
      bucket.attempts += 1;
      if (row.is_correct) bucket.correct += 1;
      bucket.totalTime += row.time_taken_seconds ?? 0;
      buckets.set(subject, bucket);
    }

    const subjects = [...buckets.entries()]
      .map(([subject, b]) => ({
        subject,
        attempts: b.attempts,
        correct: b.correct,
        accuracyPercent: Math.round((b.correct / b.attempts) * 1000) / 10,
        avgTimeSeconds: Math.round(b.totalTime / b.attempts),
      }))
      .sort((a, b) => a.accuracyPercent - b.accuracyPercent);

    const totalAttempts = subjects.reduce((sum, s) => sum + s.attempts, 0);

    return {
      content: [{ type: "text", text: JSON.stringify({ totalAttempts, subjects }, null, 2) }],
      structuredContent: { totalAttempts, subjects },
    };
  },
});
