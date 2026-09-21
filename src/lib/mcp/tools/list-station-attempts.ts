import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_station_attempts",
  title: "List clinical station attempts",
  description:
    "List the signed-in candidate's recent OSCE clinical station attempts with subject, mode, scores and time taken.",
  inputSchema: {
    limit: z.number().int().min(1).max(30).default(10).describe("How many station attempts to return (1-30)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("station_attempts")
      .select("id, created_at, subject, mode, station_index, time_taken_seconds, scores, psychograph")
      .eq("user_id", ctx.getUserId() ?? "")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new ToolError(error.message);

    const stations = (data ?? []).map((row) => ({
      id: row.id,
      attemptedAt: row.created_at,
      subject: row.subject,
      mode: row.mode,
      stationIndex: row.station_index,
      timeTakenSeconds: row.time_taken_seconds,
      scores: JSON.parse(JSON.stringify(row.scores ?? {})) as Record<string, unknown>,
      psychograph: JSON.parse(JSON.stringify(row.psychograph ?? {})) as Record<string, unknown>,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(stations, null, 2) }],
      structuredContent: { stations },
    };
  },
});
