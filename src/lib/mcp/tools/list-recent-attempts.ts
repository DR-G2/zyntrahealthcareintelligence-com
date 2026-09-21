import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_recent_attempts",
  title: "List recent question attempts",
  description:
    "List the signed-in candidate's most recent MCQ attempts with the question text, chosen answer, correctness and timing.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many attempts to return (1-50)."),
    only_incorrect: z.boolean().default(false).describe("Return only attempts that were answered incorrectly."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, only_incorrect }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("user_attempts")
      .select(
        "id, created_at, is_correct, selected_answer, time_taken_seconds, answer_changes_count, questions(zyntra_id, question_text, category, subtopic, difficulty, correct_answer)",
      )
      .eq("user_id", ctx.getUserId() ?? "")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (only_incorrect) query = query.eq("is_correct", false);

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    const attempts = (data ?? []).map((row) => {
      const question = row.questions as
        | {
            zyntra_id: string | null;
            question_text: string;
            category: string;
            subtopic: string | null;
            difficulty: string;
            correct_answer: string;
          }
        | null;
      return {
        id: row.id,
        answeredAt: row.created_at,
        isCorrect: row.is_correct,
        selectedAnswer: row.selected_answer,
        correctAnswer: question?.correct_answer ?? null,
        timeTakenSeconds: row.time_taken_seconds,
        answerChanges: row.answer_changes_count,
        questionId: question?.zyntra_id ?? null,
        questionText: question?.question_text ?? null,
        subject: question?.category ?? null,
        subtopic: question?.subtopic ?? null,
        difficulty: question?.difficulty ?? null,
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(attempts, null, 2) }],
      structuredContent: { attempts },
    };
  },
});
