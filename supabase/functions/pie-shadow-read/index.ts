import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "missing_authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "server_configuration_error" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  // Read persisted shadow output first. This proves that P13 is attached to the
  // certified shadow store, without exposing pie.* to the browser.
  const { data: recentRows, error } = await serviceClient
    .schema("pie")
    .from("inference_shadow")
    .select("id,user_id,dimension,explanation,model_version,source_state_version,evidence_maturity,signal_quality,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) return json({ error: "shadow_read_failed" }, 500);
  if (!recentRows?.length) {
    return json({
      status: "no_inference",
      shadow_only: true,
      authoritative: false,
      influences_adaptation: false,
    });
  }

  const latestHash = (recentRows[0].explanation as Record<string, unknown> | null)?.inference_hash;
  const persisted = latestHash
    ? recentRows.filter((row) => (row.explanation as Record<string, unknown> | null)?.inference_hash === latestHash)
    : recentRows.filter((row) => row.created_at === recentRows[0].created_at);

  // The certified P12 response is the authoritative dimension contract. The
  // persisted table does not contain per-dimension evidence_quality, so P13
  // deliberately does not reconstruct it from other fields.
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
  if (!p12Response.ok) return json({ error: "certified_shadow_contract_unavailable" }, 503);

  if (
    p12.shadow_only !== true ||
    p12.authoritative !== false ||
    p12.influences_adaptation !== false ||
    p12.model_version !== "pie-inference-v2.1-shadow"
  ) {
    return json({ error: "p12_contract_violation" }, 502);
  }

  const dimensions = Array.isArray(p12.dimensions) ? p12.dimensions : [];
  const persistedHash = (persisted[0]?.explanation as Record<string, unknown> | null)?.inference_hash ?? null;
  const p12Hash = typeof p12.inference_hash === "string" ? p12.inference_hash : null;

  return json({
    status: dimensions.length === 6 ? "ready" : "incomplete",
    shadow_only: true,
    authoritative: false,
    influences_adaptation: false,
    model_version: p12.model_version ?? persisted[0]?.model_version ?? null,
    source_state_version: p12.source_state_version ?? persisted[0]?.source_state_version ?? null,
    evidence_maturity: p12.evidence_maturity ?? persisted[0]?.evidence_maturity ?? null,
    signal_quality: p12.signal_quality ?? persisted[0]?.signal_quality ?? null,
    explanation: {
      shadow_only: true,
      model_version: p12.model_version,
      inference_hash: p12Hash ?? persistedHash,
      persisted_hash_match: Boolean(p12Hash && persistedHash && p12Hash === persistedHash),
    },
    inference_hash: p12Hash ?? persistedHash,
    persisted_hash_match: Boolean(p12Hash && persistedHash && p12Hash === persistedHash),
    persisted_at: persisted[0]?.created_at ?? null,
    inferred_at: new Date().toISOString(),
    dimensions,
  });
});
