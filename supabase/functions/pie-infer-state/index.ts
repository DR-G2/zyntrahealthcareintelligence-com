import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DEFAULT_INFERENCE_CONFIG, updateCandidateState } from "./engine.ts";
import type { CandidateState, PieObservation } from "./types.ts";

const MODEL_VERSION = "pie-inference-v2.1-shadow";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("PIE_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "server_configuration_error" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const requestedUserId = body?.user_id;
  if (requestedUserId && requestedUserId !== user.id) return json({ error: "user_scope_violation" }, 403);

  const { data: rows, error: observationError } = await serviceClient
    .from("pie_observation").select("*").eq("user_id", user.id).order("occurred_at", { ascending: true });
  if (observationError) return json({ error: "observation_query_failed", detail: observationError.message }, 500);
  if (!rows?.length) {
    return json({ status: "no_observations", shadow_only: true, authoritative: false, influences_adaptation: false, model_version: MODEL_VERSION, observation_count: 0 });
  }

  const config = { ...DEFAULT_INFERENCE_CONFIG, modelVersion: MODEL_VERSION };
  let state: CandidateState | undefined;
  for (const row of rows) {
    const observation: PieObservation = {
      occurredAt: row.occurred_at, outcome: row.outcome, confidenceNormalized: row.confidence_normalized,
      timeTotalMs: row.time_total_ms, timeToFirstInteractionMs: row.time_to_first_interaction_ms,
      timeToAnswerMs: row.time_to_answer_ms, timePostDecisionMs: row.time_post_decision_ms,
      firstAnswerCorrect: row.first_answer_correct, finalAnswerCorrect: row.final_answer_correct,
      answerChanges: row.answer_changes, changeDirection: row.change_direction,
      difficulty: row.difficulty, discrimination: row.discrimination, ambiguity: row.ambiguity,
      cognitiveDemand: row.cognitive_demand, novelty: row.novelty, timePressure: row.time_pressure,
      observationQuality: row.observation_quality, interruptionActive: row.interaction_state === "INTERRUPTED",
      learningContext: row.learning_context,
    };
    state = updateCandidateState(state, observation, config);
  }
  if (!state) return json({ error: "inference_state_unavailable" }, 500);

  const dimensions = [
    ["capability", state.capability], ["decision", state.decision], ["timing", state.timing],
    ["calibration", state.calibration], ["sustained_performance", state.sustainedPerformance], ["learning", state.learning],
  ] as const;

  const canonical = dimensions.map(([dimension, posterior]) => ({
    dimension, estimate: Number(posterior.estimate.toFixed(10)),
    uncertainty: Number(Math.sqrt(Math.max(0, posterior.variance)).toFixed(10)),
    lower: Number(posterior.lower.toFixed(10)), upper: Number(posterior.upper.toFixed(10)),
    evidence_count: posterior.evidenceCount, evidence_quality: Number(posterior.evidenceQuality.toFixed(10)),
  }));
  const inferenceHash = await sha256(JSON.stringify(canonical));

  const { data: sourceState } = await serviceClient.from("pie_candidate_state")
    .select("state_sequence").eq("user_id", user.id).order("state_sequence", { ascending: false }).limit(1).maybeSingle();

  const signalQuality = state.dataQuality >= 0.75 ? "HIGH" : state.dataQuality >= 0.5 ? "MEDIUM" : "LOW";
  const shadowRows = dimensions.map(([dimension, posterior]) => ({
    user_id: user.id, dimension, estimate: posterior.estimate,
    uncertainty: Math.sqrt(Math.max(0, posterior.variance)),
    interval: { lower: posterior.lower, upper: posterior.upper, confidence_level: posterior.confidenceLevel },
    evidence_count: posterior.evidenceCount, evidence_maturity: state.evidenceLevel,
    signal_quality: signalQuality,
    explanation: { shadow_only: true, model_version: MODEL_VERSION, identification_status: state.identificationStatus, data_quality: state.dataQuality, inference_hash: inferenceHash },
    model_version: MODEL_VERSION, source_state_version: sourceState?.state_sequence ?? null,
  }));

  const { error: shadowError } = await serviceClient.schema("pie").from("inference_shadow").insert(shadowRows);
  if (shadowError) return json({ error: "shadow_persist_failed", detail: shadowError.message }, 500);

  return json({
    status: "completed", shadow_only: true, authoritative: false, influences_adaptation: false,
    model_version: MODEL_VERSION, user_id: user.id, observation_count: rows.length,
    dimension_count: dimensions.length, inference_hash: inferenceHash,
    source_state_version: sourceState?.state_sequence ?? null, evidence_maturity: state.evidenceLevel,
  });
});
