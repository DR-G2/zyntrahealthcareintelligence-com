import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { paidRpcErrorMessage, supabaseV2ForUser } from "../supabase";

interface TrustGutRow {
  attempt_id: string;
  question_id: string;
  created_at: string;
  subject_name: string | null;
  subtopic_name: string | null;
  selected_answer: string;
  is_correct: boolean;
  answer_changes_count: number | null;
  time_taken_seconds: number | null;
}

/**
 * Paid only. Reads via the 0086 RPC get_my_trust_gut_attempts (no stem/options/explanation/key),
 * so question text is no longer returned. Non-paid callers get a generic paywall error.
 */
export default defineTool({
  name: "list_recent_attempts",
  title: "List recent question attempts",
  description:
    "List the signed-in candidate's most recent MCQ attempts with subject, chosen answer, correctness and timing (paid plans).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many attempts to return (1-50)."),
    only_incorrect: z.boolean().default(false).describe("Return only attempts that were answered incorrectly."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, only_incorrect }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseV2ForUser(ctx);

    // Over-fetch when filtering so `limit` incorrect rows can still be returned.
    const { data, error } = await supabase.rpc("get_my_trust_gut_attempts", { p_limit: only_incorrect ? 500 : limit });
    if (error) throw new ToolError(paidRpcErrorMessage(error, "Attempts"));

    const rows = ((data ?? []) as TrustGutRow[]).filter((r) => !only_incorrect || !r.is_correct).slice(0, limit);
    const attempts = rows.map((row) => ({
      id: row.attempt_id,
      answeredAt: row.created_at,
      isCorrect: row.is_correct,
      selectedAnswer: row.selected_answer,
      timeTakenSeconds: row.time_taken_seconds,
      answerChanges: row.answer_changes_count,
      questionId: row.question_id,
      subject: row.subject_name,
      subtopic: row.subtopic_name,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(attempts, null, 2) }],
      structuredContent: { attempts },
    };
  },
});
