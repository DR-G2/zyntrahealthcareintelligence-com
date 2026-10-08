import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "p21.1-telemetry-audit-v1";
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("PIE_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
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

  const { data: attempts, error: attemptError } = await serviceClient
    .from("user_attempts")
    .select("id,user_id,question_id,session_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (attemptError) return json({ error: "attempt_query_failed" }, 500);

  const attemptIds = (attempts ?? []).map((x) => x.id);
  let observations: Array<Record<string, unknown>> = [];

  if (attemptIds.length) {
    const { data, error } = await serviceClient
      .schema("pie")
      .from("pie_observation")
      .select("id,user_id,question_id,attempt_id,observed_at,provenance")
      .eq("user_id", user.id)
      .in("attempt_id", attemptIds)
      .order("observed_at", { ascending: false });

    if (error) return json({ error: "observation_query_failed" }, 500);
    observations = (data ?? []) as Array<Record<string, unknown>>;
  }

  const attemptMap = new Map((attempts ?? []).map((a) => [a.id, a]));
  const observationByAttempt = new Map<string, Record<string, unknown>>();
  let identityMismatches = 0;

  for (const o of observations) {
    const attemptId = String(o.attempt_id ?? "");
    if (!attemptId) continue;
    if (observationByAttempt.has(attemptId)) continue;
    observationByAttempt.set(attemptId, o);
    const a = attemptMap.get(attemptId);
    if (!a || o.user_id !== a.user_id || o.question_id !== a.question_id) identityMismatches++;
  }

  const missing = (attempts ?? []).filter((a) => !observationByAttempt.has(a.id)).length;
  const duplicateAttemptIds = observations.length - observationByAttempt.size;

  const latestAttempt = attempts?.[0] ?? null;
  const latestObservation = latestAttempt ? observationByAttempt.get(latestAttempt.id) ?? null : null;

  return json({
    status: "ready",
    model_version: MODEL,
    user_scoped: true,
    attempt_count: attempts?.length ?? 0,
    observation_count_for_attempts: observations.length,
    attempts_with_observation: observationByAttempt.size,
    attempts_missing_observation: missing,
    identity_mismatches: identityMismatches,
    duplicate_attempt_observation_rows: duplicateAttemptIds,
    latest_attempt_id: latestAttempt?.id ?? null,
    latest_observation_id: latestObservation?.id ?? null,
    latest_attempt_has_observation: !!latestObservation,
    latest_attempt_observation_identity_match: !!latestObservation &&
      latestObservation.user_id === latestAttempt?.user_id &&
      latestObservation.question_id === latestAttempt?.question_id,
  });
});
