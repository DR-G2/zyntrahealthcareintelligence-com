import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN =
  Deno.env.get("AMC_ALLOWED_ORIGIN") ??
  "https://www.zyntrahealthcareintelligence.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (status: number, error: string) => json({ error }, status);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(405, "method_not_allowed");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return errorResponse(500, "server_configuration_error");
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return errorResponse(401, "missing_authorization");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) return errorResponse(401, "unauthorized");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse(400, "invalid_request");

  const request = body as Record<string, unknown>;
  if (request.user_id && request.user_id !== user.id) {
    return errorResponse(403, "user_scope_violation");
  }

  const action = request.action;

  const { data: plugin, error: pluginError } = await serviceClient
    .from("amc_plugin_version")
    .select("id,plugin_code,plugin_version,status,contract_version,blueprint_version,taxonomy_version,environment_version,target_version")
    .eq("plugin_code", "AMC")
    .eq("plugin_version", "1.0.0")
    .maybeSingle();

  if (pluginError || !plugin) return errorResponse(404, "amc_plugin_unavailable");

  if (action === "get_summary") {
    const { data: activeEnvironment } = await serviceClient
      .from("amc_exam_environment_v1")
      .select("environment_code,environment_version,exam_mode")
      .eq("plugin_version_id", plugin.id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return json({
      plugin: "AMC",
      pluginVersion: plugin.plugin_version,
      status: plugin.status,
      environmentCode: activeEnvironment?.environment_code ?? null,
      examMode: activeEnvironment?.exam_mode ?? null,
      readiness: null,
      nextAction: null,
    });
  }

  if (action === "get_blueprint") {
    const mode = request.exam_mode;
    if (mode !== "MCQ" && mode !== "CLINICAL") {
      return errorResponse(400, "invalid_exam_mode");
    }

    const { data, error } = await serviceClient
      .from("amc_blueprint")
      .select("exam_mode,patient_group,task_domain,proportion,item_target")
      .eq("plugin_version_id", plugin.id)
      .eq("exam_mode", mode);

    if (error) return errorResponse(500, "blueprint_query_failed");

    return json({
      plugin: "AMC",
      pluginVersion: plugin.plugin_version,
      examMode: mode,
      blueprint: data ?? [],
    });
  }

  // v1 intentionally exposes no raw intelligence endpoint.
  // Candidate clients cannot request PIE state, question posteriors,
  // DWIG candidates, hidden hypotheses, causal evidence, or intervention effects.
  return errorResponse(400, "unsupported_action");
});
