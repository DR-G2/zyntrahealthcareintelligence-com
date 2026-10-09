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
  if (action === "get_blueprint" && request.exam_mode !== "MCQ" && request.exam_mode !== "CLINICAL") {
    return errorResponse(400, "invalid_exam_mode", responseOrigin);
  }

  // The public RPC is a narrow server-only bridge into V2's non-exposed amc schema.
  // The browser never receives direct access to internal AMC tables.
  const { data, error } = await serviceClient.rpc("amc_plugin_v1_runtime_read", {
    p_action: action,
    p_exam_mode: action === "get_blueprint" ? request.exam_mode : null,
  });
  if (error) return errorResponse(500, "amc_runtime_read_failed", responseOrigin);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return errorResponse(500, "amc_runtime_invalid_response", responseOrigin);
  }
  return json(data, 200, responseOrigin);
});
