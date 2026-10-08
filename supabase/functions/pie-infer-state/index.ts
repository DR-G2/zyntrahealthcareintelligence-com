import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL_VERSION = "pie-inference-v2.1-shadow";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("PIE_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function update(
  prior: { estimate: number; variance: number; evidence_count: number; evidence_quality: number },
  signal: number | null,
  measurementVariance: number,
  quality: number,
) {
  const predicted = prior.variance + 0.0025;
  if (signal == null || quality <= 0) {
    return { ...prior, variance: predicted };
  }
  const effective = measurementVariance / Math.max(quality, 0.05);
  const gain = predicted / (predicted + effective);
  const estimate = clamp01(prior.estimate + gain * (signal - prior.estimate));
  const variance = Math.max(1e-8, (1 - gain) * predicted);
  return {
    estimate,
    variance,
    evidence_count: prior.evidence_count + 1,
    evidence_quality: clamp01((prior.evidence_quality * prior.evidence_count + quality) / (prior.evidence_count + 1)),
  };
}

function infer(rows: any[]) {
  const make = () => ({
    estimate: 0.5,
    variance: 0.25,
    evidence_count: 0,
    evidence_quality: 0,
  });

  const s = {
    capability: make(),
    decision: make(),
    timing: make(),
    calibration: make(),
    sustained_performance: make(),
    learning: make(),
  };

  let previousOutcome: number | null = null;

  for (const row of rows) {
    const payload = row.payload ?? {};

    const quality =
      payload.observation_quality === "UNUSABLE" ? 0 :
      payload.observation_quality === "CONTRADICTORY" ? 0.15 :
      payload.observation_quality === "SUSPICIOUS" ? 0.5 :
      payload.interaction_state === "INTERRUPTED" ? 0.25 :
      1;

    const outcome =
      payload.outcome === "CORRECT" ? 1 :
      payload.outcome === "INCORRECT" ? 0 :
      null;

    const timing =
      typeof payload.time_total_ms === "number" && payload.time_total_ms > 0
        ? clamp01(1 / (1 + Math.log1p(payload.time_total_ms / 1000) / 10))
        : null;

    const decision =
      typeof payload.first_answer_correct === "boolean" &&
      typeof payload.final_answer_correct === "boolean"
        ? payload.first_answer_correct === payload.final_answer_correct
          ? 0.5
          : payload.final_answer_correct ? 0.75 : 0.25
        : null;

    const calibration =
      typeof payload.confidence_normalized === "number" && outcome != null
        ? clamp01(1 - Math.abs(payload.confidence_normalized - outcome))
        : null;

    const learning =
      outcome == null || previousOutcome == null
        ? null
        : clamp01(0.5 + 0.5 * (outcome - previousOutcome));

    s.capability = update(s.capability, outcome, 0.08, quality);
    s.decision = update(s.decision, decision, 0.12, quality);
    s.timing = update(s.timing, timing, 0.12, quality);
    s.calibration = update(s.calibration, calibration, 0.12, quality);
    s.sustained_performance = update(s.sustained_performance, outcome, 0.15, quality);
    s.learning = update(s.learning, learning, 0.18, quality);

    if (outcome != null) previousOutcome = outcome;
  }

  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "server_configuration_error" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.user_id && body.user_id !== user.id) {
    return json({ error: "user_scope_violation" }, 403);
  }

  const { data: rows, error } = await serviceClient
    .schema("pie").from("pie_observation")
    .select("user_id,observation_type,observed_at,payload,provenance")
    .eq("user_id", user.id)
    .order("observed_at", { ascending: true })\n    .order("id", { ascending: true });

  if (error) return json({ error: "observation_query_failed", detail: error.message }, 500);

  if (!rows?.length) {
    return json({
      status: "no_observations",
      shadow_only: true,
      authoritative: false,
      influences_adaptation: false,
      model_version: MODEL_VERSION,
      observation_count: 0,
    });
  }

  const state = infer(rows);
  const dimensions = [
    ["capability", state.capability],
    ["decision", state.decision],
    ["timing", state.timing],
    ["calibration", state.calibration],
    ["sustained_performance", state.sustained_performance],
    ["learning", state.learning],
  ] as const;

  const canonical = dimensions.map(([dimension, p]) => ({
    dimension,
    estimate: Number(p.estimate.toFixed(10)),
    uncertainty: Number(Math.sqrt(p.variance).toFixed(10)),
    lower: Number(clamp01(p.estimate - 1.96 * Math.sqrt(p.variance)).toFixed(10)),
    upper: Number(clamp01(p.estimate + 1.96 * Math.sqrt(p.variance)).toFixed(10)),
    evidence_count: p.evidence_count,
    evidence_quality: Number(p.evidence_quality.toFixed(10)),
  }));

  const inferenceHash = await sha256(JSON.stringify(canonical));

  const { data: sourceState } = await serviceClient
    .from("pie_candidate_state")
    .select("state_sequence")
    .eq("user_id", user.id)
    .order("state_sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sourceStateError) return json({ error: "source_state_query_failed", detail: sourceStateError.message }, 500);\n\n  const averageQuality = canonical.reduce((n, x) => n + x.evidence_quality, 0) / canonical.length;
  const evidenceCount = canonical.reduce((n, x) => n + x.evidence_count, 0) / canonical.length;
  const maturity = evidenceCount < 6 ? "INSUFFICIENT" : evidenceCount < 20 ? "PRELIMINARY" : evidenceCount < 40 ? "DEVELOPING" : "ESTABLISHED_INDIVIDUAL_EVIDENCE";
  const signalQuality = averageQuality >= 0.75 ? "HIGH" : averageQuality >= 0.5 ? "MEDIUM" : "LOW";

  const shadowRows = canonical.map((p) => ({
    user_id: user.id,
    dimension: p.dimension,
    estimate: p.estimate,
    uncertainty: p.uncertainty,
    interval: { lower: p.lower, upper: p.upper, confidence_level: 0.95 },
    evidence_count: p.evidence_count,
    evidence_maturity: maturity,
    signal_quality: signalQuality,
    explanation: {
      shadow_only: true,
      model_version: MODEL_VERSION,
      inference_hash: inferenceHash,
    },
    model_version: MODEL_VERSION,
    source_state_version: sourceState?.state_version ?? null,
  }));

  const { error: shadowError } = await serviceClient
    .schema("pie")
    .from("inference_shadow")
    .insert(shadowRows);

  if (shadowError) {
    return json({ error: "shadow_persist_failed", detail: shadowError.message }, 500);
  }

  return json({
    status: "completed",
    shadow_only: true,
    authoritative: false,
    influences_adaptation: false,
    model_version: MODEL_VERSION,
    user_id: user.id,
    observation_count: rows.length,
    dimension_count: 6,
    dimensions: canonical,
    inference_hash: inferenceHash,
    source_state_version: sourceState?.state_sequence ?? null,
    evidence_maturity: maturity,
  });
});
