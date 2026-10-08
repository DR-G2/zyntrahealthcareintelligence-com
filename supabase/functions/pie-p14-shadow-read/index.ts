import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL_VERSION = "pie-inference-v2.1-shadow";
const DIMENSIONS = ["capability", "decision", "timing", "calibration", "sustained_performance", "learning"] as const;

const allowedOrigin = Deno.env.get("PIE_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function completeDimensions(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 6) return false;
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const d = item as Record<string, unknown>;
    if (typeof d.dimension !== "string" || !DIMENSIONS.includes(d.dimension as typeof DIMENSIONS[number])) return false;
    if (seen.has(d.dimension)) return false;
    seen.add(d.dimension);
    for (const key of ["estimate", "uncertainty", "lower", "upper", "evidence_count", "evidence_quality"]) {
      if (typeof d[key] !== "number" || !Number.isFinite(d[key] as number)) return false;
    }
  }
  return seen.size === 6;
}

function responseFromProjection(row: Record<string, unknown>) {
  return {
    status: completeDimensions(row.dimensions) ? "ready" : "incomplete",
    read_source: "projection",
    shadow_only: true,
    authoritative: false,
    influences_adaptation: false,
    model_version: row.model_version,
    source_state_version: row.source_state_version ?? null,
    evidence_maturity: row.evidence_maturity ?? null,
    signal_quality: row.signal_quality ?? null,
    explanation: row.explanation ?? null,
    inference_hash: row.inference_hash,
    inferred_at: row.inferred_at,
    observation_count: row.observation_count,
    dimensions: row.dimensions,
  };
}

Deno.serve(async (req) => {
  const started = Date.now();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "missing_authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "server_configuration_error" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  // Client-supplied identity is intentionally ignored. The authenticated JWT is the scope.
  const { count: observationCount, error: countError } = await serviceClient
    .schema("pie")
    .from("pie_observation")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) {
    console.error("p14 observation count failed", countError.message);
    return json({ error: "observation_read_failed" }, 500);
  }

  if (!observationCount) {
    console.log("p14 shadow read", JSON.stringify({ status: "no_inference", source: "observation_empty", duration_ms: Date.now() - started }));
    return json({
      status: "no_inference",
      read_source: "projection",
      shadow_only: true,
      authoritative: false,
      influences_adaptation: false,
    });
  }

  const { data: latestObservation, error: latestError } = await serviceClient
    .schema("pie")
    .from("pie_observation")
    .select("id,observed_at")
    .eq("user_id", user.id)
    .order("observed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    console.error("p14 latest observation failed", latestError.message);
    return json({ error: "observation_read_failed" }, 500);
  }

  const { data: projection, error: projectionError } = await serviceClient
    .schema("pie")
    .from("inference_projection")
    .select("user_id,inference_hash,observation_count,latest_observation_id,latest_observed_at,dimensions,model_version,source_state_version,evidence_maturity,signal_quality,explanation,inferred_at,shadow_only,authoritative,influences_adaptation")
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectionError) {
    console.error("p14 projection read failed", projectionError.message);
    return json({ error: "projection_read_failed" }, 500);
  }

  const projectionFresh =
    projection &&
    projection.shadow_only === true &&
    projection.authoritative === false &&
    projection.influences_adaptation === false &&
    projection.model_version === MODEL_VERSION &&
    projection.observation_count === observationCount &&
    projection.latest_observation_id === (latestObservation?.id ?? null) &&
    completeDimensions(projection.dimensions);

  if (projectionFresh) {
    console.log("p14 shadow read", JSON.stringify({ status: "ready", source: "projection", duration_ms: Date.now() - started }));
    return json(responseFromProjection(projection));
  }

  // P14 never recomputes inference. It asks the certified P12 engine for the
  // canonical contract, then stores that exact output as the application projection.
  const p12Response = await fetch(supabaseUrl + "/functions/v1/pie-infer-state", {
    method: "POST",
    headers: {
      Authorization: authorization,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const p12 = await p12Response.json().catch(() => ({}));
  if (!p12Response.ok) {
    console.warn("p14 shadow refresh unavailable", JSON.stringify({ status: p12Response.status }));
    return json({ error: "certified_shadow_contract_unavailable" }, 503);
  }

  if (
    p12.shadow_only !== true ||
    p12.authoritative !== false ||
    p12.influences_adaptation !== false ||
    p12.model_version !== MODEL_VERSION ||
    !completeDimensions(p12.dimensions)
  ) {
    console.error("p14 p12 contract validation failed");
    return json({ error: "p12_contract_violation" }, 502);
  }

  const sourceStateVersion = typeof p12.source_state_version === "number" ? p12.source_state_version : null;
  const inferenceHash = typeof p12.inference_hash === "string" ? p12.inference_hash : null;
  if (!inferenceHash) return json({ error: "p12_missing_inference_hash" }, 502);

  const projectionRow = {
    user_id: user.id,
    inference_hash: inferenceHash,
    observation_count: Number(p12.observation_count ?? observationCount),
    latest_observation_id: latestObservation?.id ?? null,
    latest_observed_at: latestObservation?.observed_at ?? null,
    dimensions: p12.dimensions,
    model_version: MODEL_VERSION,
    source_state_version: sourceStateVersion,
    evidence_maturity: p12.evidence_maturity ?? null,
    signal_quality: p12.signal_quality ?? null,
    explanation: p12.explanation ?? { shadow_only: true, model_version: MODEL_VERSION, inference_hash: inferenceHash },
    inferred_at: new Date().toISOString(),
    shadow_only: true,
    authoritative: false,
    influences_adaptation: false,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await serviceClient
    .schema("pie")
    .from("inference_projection")
    .upsert(projectionRow, { onConflict: "user_id" });

  if (upsertError) {
    console.error("p14 projection write failed", upsertError.message);
    return json({ error: "projection_write_failed" }, 500);
  }

  console.log("p14 shadow read", JSON.stringify({ status: "ready", source: "p12_refresh", duration_ms: Date.now() - started }));
  return json({
    status: "ready",
    read_source: "p12_refresh",
    shadow_only: true,
    authoritative: false,
    influences_adaptation: false,
    model_version: MODEL_VERSION,
    source_state_version: sourceStateVersion,
    evidence_maturity: p12.evidence_maturity ?? null,
    signal_quality: p12.signal_quality ?? null,
    explanation: p12.explanation ?? { shadow_only: true, model_version: MODEL_VERSION, inference_hash: inferenceHash },
    inference_hash: inferenceHash,
    inferred_at: projectionRow.inferred_at,
    observation_count: projectionRow.observation_count,
    dimensions: p12.dimensions,
  });
});
