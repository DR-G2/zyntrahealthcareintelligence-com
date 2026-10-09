import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ORIGIN = "https://www.zyntrahealthcareintelligence.com";
const json = (body: unknown, status = 200, origin = DEFAULT_ORIGIN) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const errorResponse = (status: number, error: string, origin: string) =>
  json({ error }, status, origin);

Deno.serve(async (req) => {
  const configuredOrigins = (Deno.env.get("AMC_ALLOWED_ORIGINS") ?? DEFAULT_ORIGIN)
    .split(",").map((value) => value.trim()).filter(Boolean);
  const requestOrigin = req.headers.get("Origin") ?? "";
  const originAllowed = !requestOrigin || configuredOrigins.includes(requestOrigin);
  const responseOrigin = requestOrigin && originAllowed ? requestOrigin : DEFAULT_ORIGIN;

  if (req.method === "OPTIONS") {
    if (!originAllowed) return new Response(null, { status: 403 });
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": responseOrigin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin",
      },
    });
  }
  if (!originAllowed) return errorResponse(403, "origin_not_allowed", DEFAULT_ORIGIN);
  if (req.method !== "POST") return errorResponse(405, "method_not_allowed", responseOrigin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return errorResponse(500, "server_configuration_error", responseOrigin);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return errorResponse(401, "missing_authorization", responseOrigin);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return errorResponse(401, "unauthorized", responseOrigin);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse(400, "invalid_request", responseOrigin);
  }
  const request = body as Record<string, unknown>;
  if (request.user_id !== undefined && request.user_id !== user.id) {
    return errorResponse(403, "user_scope_violation", responseOrigin);
  }

  const action = request.action;
  if (action !== "get_summary" && action !== "get_blueprint") {
    return errorResponse(400, "unsupported_action", responseOrigin);
  }

  // V2 uses the dedicated amc schema and its V2 adapter tables.
  // Do not query the legacy public.amc_* schema from this endpoint.
  const amc = serviceClient.schema("amc");
  const { data: plugin, error: pluginError } = await amc
    .from("amc_plugin_version")
    .select("id,version,status,config")
    .eq("version", "1.0.0")
    .maybeSingle();

  if (pluginError) return errorResponse(500, "amc_plugin_query_failed", responseOrigin);
  if (!plugin) return errorResponse(404, "amc_plugin_unavailable", responseOrigin);

  if (action === "get_summary") {
    const { data: environment, error } = await amc
      .from("amc_exam_environment")
      .select("exam_key,version,environment,effective_from,effective_to")
      .eq("exam_key", "AMC_CAT_MCQ")
      .eq("version", "V8")
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return errorResponse(500, "amc_environment_query_failed", responseOrigin);

    return json({
      plugin: "AMC",
      pluginVersion: plugin.version,
      status: plugin.status,
      environmentCode: environment?.exam_key ?? null,
      environmentVersion: environment?.version ?? null,
      environment: environment?.environment ?? null,
      readiness: null,
      nextAction: null,
    }, 200, responseOrigin);
  }

  const mode = request.exam_mode;
  if (mode !== "MCQ" && mode !== "CLINICAL") {
    return errorResponse(400, "invalid_exam_mode", responseOrigin);
  }
  const blueprintKey = mode === "MCQ" ? "AMC_CAT_MCQ" : "AMC_CLINICAL";
  const blueprintVersion = mode === "MCQ" ? "V8" : "2026.1";
  const { data: blueprint, error: blueprintError } = await amc
    .from("amc_blueprint")
    .select("blueprint_key,version,content")
    .eq("plugin_version_id", plugin.id)
    .eq("blueprint_key", blueprintKey)
    .eq("version", blueprintVersion)
    .maybeSingle();

  if (blueprintError) return errorResponse(500, "amc_blueprint_query_failed", responseOrigin);
  return json({
    plugin: "AMC",
    pluginVersion: plugin.version,
    examMode: mode,
    blueprint: blueprint?.content ?? null,
    blueprintVersion: blueprint?.version ?? null,
  }, 200, responseOrigin);
});
