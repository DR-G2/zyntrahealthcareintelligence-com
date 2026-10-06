import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigin = Deno.env.get("PIE_ALLOWED_ORIGIN");
const allowedOrigins = new Set([
  "https://www.zyntrahealthcareintelligence.com",
  "https://zyntrahealthcareintelligence.com",
  ...(configuredOrigin ? configuredOrigin.split(",").map((value) => value.trim()).filter(Boolean) : []),
]);

Deno.serve(async (req) => {
    const requestOrigin = req.headers.get("Origin");
    const responseCors = {
      "Access-Control-Allow-Origin": requestOrigin && allowedOrigins.has(requestOrigin)
        ? requestOrigin
        : "https://www.zyntrahealthcareintelligence.com",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    };

    // Handle browser preflight before authentication. Supabase invoke() may
    // send this request before the authenticated POST.
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseCors });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

    if (!supabaseUrl || !serviceKey || !anonKey) return new Response(JSON.stringify({ error: "server_configuration_error" }), { status: 500, headers: { ...responseCors, "Content-Type": "application/json" } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...responseCors, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...responseCors, "Content-Type": "application/json" } });

    const ctx = {
      supabaseAdmin: createClient(supabaseUrl, serviceKey),
      userClaims: { sub: user.id },
    };
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...responseCors, "Content-Type": "application/json" } });
    }

    const userId = ctx.userClaims?.sub;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...responseCors, "Content-Type": "application/json" } });

    // Confidence telemetry was introduced after the original PIE schema. Keep
    // this runtime backward-compatible so a partially migrated production
    // database cannot crash the Edge Function or blank the Intelligence page.
    const baseAttemptSelect = "id,user_id,question_id,selected_answer,is_correct,session_id,created_at,time_taken_seconds,answer_changes_count,time_to_first_click,change_sequence,pause_events,question_position,question_difficulty_at_attempt,question_dna_version_at_attempt,questions(correct_answer)";
    let attemptsResult = await ctx.supabaseAdmin
      .from("user_attempts")
      .select(baseAttemptSelect + ",confidence_level")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);

    let confidenceColumnAvailable = true;
    if (attemptsResult.error && /confidence_level.*column|column.*confidence_level|schema cache/i.test(attemptsResult.error.message || "")) {
      confidenceColumnAvailable = false;
      console.warn("[PIE shadow] confidence_level is unavailable; using legacy attempt projection");
      attemptsResult = await ctx.supabaseAdmin
        .from("user_attempts")
        .select(baseAttemptSelect)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
    }

    if (attemptsResult.error) return new Response(JSON.stringify({ error: "attempt_query_failed" }), { status: 500, headers: { ...responseCors, "Content-Type": "application/json" } });
    if (!attemptsResult.data?.length) return new Response(JSON.stringify({ status: "no_new_observations", normalized: 0 }), { status: 200, headers: { ...responseCors, "Content-Type": "application/json" } });

    const ids = attemptsResult.data.map((a) => a.id);
    const existingResult = await ctx.supabaseAdmin
      .from("pie_observation")
      .select("source_attempt_id")
      .eq("user_id", userId)
      .in("source_attempt_id", ids);

    if (existingResult.error) return new Response(JSON.stringify({ error: "observation_query_failed" }), { status: 500, headers: { ...responseCors, "Content-Type": "application/json" } });

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
        const confidence = confidenceColumnAvailable && typeof a.confidence_level === "number"
          ? Math.max(0, Math.min(1, (a.confidence_level - 1) / 4))
          : null;

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
        return new Response(JSON.stringify({ error: "observation_insert_failed" }), { status: 500, headers: { ...responseCors, "Content-Type": "application/json" } });
      }
    }

    const auth = req.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const publishable = Deno.env.get("SUPABASE_ANON_KEY");
    if (!auth || !url || !publishable) return new Response(JSON.stringify({ error: "server_configuration_error" }), { status: 500, headers: { ...responseCors, "Content-Type": "application/json" } });

    const inference = await fetch(url + "/functions/v1/pie-infer-state", {
      method: "POST",
      headers: { Authorization: auth, apikey: publishable, "Content-Type": "application/json" },
      body: "{}",
    });

    if (!inference.ok) {
      console.warn("[PIE shadow] inference refresh failed", inference.status);
      return new Response(JSON.stringify({ status: "normalized_inference_pending", normalized: fresh.length }), { status: 200, headers: { ...responseCors, "Content-Type": "application/json" } });
    }

    // Controlled candidate-facing bridge: expose only the bounded PIE state
    // required by the Performance Intelligence page. Internal PIE tables remain
    // unreadable to authenticated clients.
    const latestState = await ctx.supabaseAdmin
      .from("pie_candidate_state")
      .select("state_timestamp,state_sequence,capability_estimate,decision_estimate,timing_estimate,calibration_estimate,sustained_performance_estimate,learning_estimate,identification_status,evidence_level,data_quality,observation_count,model_version")
      .eq("user_id", userId)
      .order("state_sequence", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestState.error) {
      console.warn("[PIE shadow] latest state read failed", latestState.error.message);
      return new Response(JSON.stringify({
        status: fresh.length ? "completed" : "no_new_observations",
        normalized: fresh.length,
        pie: null,
      }), { status: 200, headers: { ...responseCors, "Content-Type": "application/json" } });
    }

    const pie = latestState.data
      ? {
          state_timestamp: latestState.data.state_timestamp,
          state_sequence: Number(latestState.data.state_sequence ?? 0),
          capability: Number(latestState.data.capability_estimate ?? 0),
          decision: Number(latestState.data.decision_estimate ?? 0),
          timing: Number(latestState.data.timing_estimate ?? 0),
          calibration: Number(latestState.data.calibration_estimate ?? 0),
          sustained_performance: Number(latestState.data.sustained_performance_estimate ?? 0),
          learning: Number(latestState.data.learning_estimate ?? 0),
          identification_status: latestState.data.identification_status,
          evidence_level: latestState.data.evidence_level,
          data_quality: Number(latestState.data.data_quality ?? 0),
          observation_count: Number(latestState.data.observation_count ?? 0),
          model_version: latestState.data.model_version,
        }
      : null;

    return new Response(JSON.stringify({
      status: fresh.length ? "completed" : "no_new_observations",
      normalized: fresh.length,
      pie,
    }), { status: 200, headers: { ...responseCors, "Content-Type": "application/json" } });
});
