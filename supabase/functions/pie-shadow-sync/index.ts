import { withSupabase } from "npm:@supabase/server@1";

const origin = Deno.env.get("PIE_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    }

    const userId = ctx.userClaims?.sub;
    if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

    const attemptsResult = await ctx.supabaseAdmin
      .from("user_attempts")
      .select("id,user_id,question_id,selected_answer,is_correct,session_id,created_at,time_taken_seconds,answer_changes_count,time_to_first_click,change_sequence,pause_events,question_position,question_difficulty_at_attempt,question_dna_version_at_attempt,confidence_level,questions(correct_answer)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (attemptsResult.error) return Response.json({ error: "attempt_query_failed" }, { status: 500 });
    if (!attemptsResult.data?.length) return Response.json({ status: "no_new_observations", normalized: 0 });

    const ids = attemptsResult.data.map((a) => a.id);
    const existingResult = await ctx.supabaseAdmin
      .from("pie_observation")
      .select("source_attempt_id")
      .eq("user_id", userId)
      .in("source_attempt_id", ids);

    if (existingResult.error) return Response.json({ error: "observation_query_failed" }, { status: 500 });

    const seen = new Set((existingResult.data ?? []).map((r) => r.source_attempt_id).filter(Boolean));
    const fresh = attemptsResult.data.filter((a) => !seen.has(a.id));

    const difficultyOf = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
      if (typeof value !== "string") return null;
      const n = Number(value);
      if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
      const v = value.toLowerCase();
      return v === "easy" ? 0.25 : v === "moderate" || v === "medium" ? 0.5 : v === "difficult" || v === "hard" ? 0.75 : null;
    };

    if (fresh.length) {
      const rows = fresh.map((a) => {
        const finalCorrect = Boolean(a.is_correct);
        const q = Array.isArray(a.questions) ? a.questions[0] : a.questions;
        const first = Array.isArray(a.change_sequence) && a.change_sequence.length ? String(a.change_sequence[0]) : null;
        const confidence = typeof a.confidence_level === "number" ? Math.max(0, Math.min(1, (a.confidence_level - 1) / 4)) : null;

        return {
          user_id: userId,
          session_id: a.session_id,
          question_id: a.question_id,
          question_version: a.question_dna_version_at_attempt != null ? String(a.question_dna_version_at_attempt) : "legacy",
          occurred_at: a.created_at,
          question_position: a.question_position,
          outcome: finalCorrect ? "CORRECT" : "INCORRECT",
          confidence_raw: a.confidence_level,
          confidence_normalized: confidence,
          time_total_ms: typeof a.time_taken_seconds === "number" ? Math.max(0, a.time_taken_seconds * 1000) : null,
          time_to_first_interaction_ms: typeof a.time_to_first_click === "number" ? Math.max(0, a.time_to_first_click * 1000) : null,
          first_answer: first,
          final_answer: a.selected_answer,
          first_answer_correct: first && q?.correct_answer ? first === q.correct_answer : null,
          final_answer_correct: finalCorrect,
          answer_changes: Math.max(0, Number(a.answer_changes_count ?? 0)),
          change_direction: first == null || first === a.selected_answer ? "UNCHANGED" : finalCorrect ? "FIRST_TO_FINAL_CORRECT" : "FIRST_TO_FINAL_INCORRECT",
          interaction_state: Number(a.pause_events ?? 0) > 0 ? "PAUSED" : "ACTIVE",
          environment_state: "PRACTICE",
          observation_quality: "VALID",
          observation_version: 1,
          source_event_ids: null,
          source_attempt_id: a.id,
          difficulty: difficultyOf(a.question_difficulty_at_attempt),
        };
      });

      const insertResult = await ctx.supabaseAdmin.from("pie_observation").insert(rows);
      if (insertResult.error && !/duplicate|unique/i.test(insertResult.error.message)) {
        return Response.json({ error: "observation_insert_failed" }, { status: 500 });
      }
    }

    const auth = req.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const publishable = Deno.env.get("SUPABASE_ANON_KEY");
    if (!auth || !url || !publishable) return Response.json({ error: "server_configuration_error" }, { status: 500 });

    const inference = await fetch(url + "/functions/v1/pie-infer-state", {
      method: "POST",
      headers: { Authorization: auth, apikey: publishable, "Content-Type": "application/json" },
      body: "{}",
    });

    if (!inference.ok) {
      console.warn("[PIE shadow] inference refresh failed", inference.status);
      return Response.json({ status: "normalized_inference_pending", normalized: fresh.length });
    }

    return Response.json({ status: fresh.length ? "completed" : "no_new_observations", normalized: fresh.length });
  }, { cors: { origin } }),
};
