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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseExamMode(value: unknown): "MCQ" | "CLINICAL" | null {
  if (value === undefined || value === "MCQ") return "MCQ";
  if (value === "CLINICAL") return "CLINICAL";
  return null;
}

function readinessDTO(value: unknown) {
  if (!isRecord(value)) return null;
  const readiness = isRecord(value.readiness) ? value.readiness : {};
  const index = readiness.index;
  const uncertainty = readiness.uncertainty;
  const lower = readiness.lower;
  const upper = readiness.upper;
  const evidenceCount = value.evidence_count;
  return {
    plugin: "AMC",
    pluginVersion: typeof value.pluginVersion === "string" ? value.pluginVersion : "1.0.0",
    examMode: value.examMode === "CLINICAL" ? "CLINICAL" : "MCQ",
    environmentCode: typeof value.environmentCode === "string" ? value.environmentCode : null,
    readiness: {
      probability: null,
      index: typeof index === "number" && Number.isFinite(index) ? index : null,
      uncertainty: typeof uncertainty === "number" && Number.isFinite(uncertainty) ? uncertainty : null,
      lower: typeof lower === "number" && Number.isFinite(lower) ? lower : null,
      upper: typeof upper === "number" && Number.isFinite(upper) ? upper : null,
      status: typeof readiness.status === "string" ? readiness.status : "INSUFFICIENT_EVIDENCE",
    },
    evidenceCount: Number.isInteger(evidenceCount) && (evidenceCount as number) >= 0 ? evidenceCount : 0,
    probabilityStatus: "NOT_CALIBRATED",
    modelVersion: typeof value.modelVersion === "string" ? value.modelVersion : "amc-readiness-v1.0",
  };
}

Deno.serve(async (req) => {
  const configuredOrigins = (
    Deno.env.get("AMC_ALLOWED_ORIGINS") ??
    Deno.env.get("AMC_ALLOWED_ORIGIN") ??
    DEFAULT_ORIGIN
  ).split(",").map((value) => value.trim()).filter(Boolean);
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
  if (!isRecord(body)) return errorResponse(400, "invalid_request", responseOrigin);
  if (body.user_id !== undefined && body.user_id !== user.id) {
    return errorResponse(403, "user_scope_violation", responseOrigin);
  }

  const action = body.action;
  if (!["get_summary", "get_blueprint", "get_readiness"].includes(String(action))) {
    return errorResponse(400, "unsupported_action", responseOrigin);
  }
  const mode = parseExamMode(body.exam_mode);
  if (body.exam_mode !== undefined && mode === null) {
    return errorResponse(400, "invalid_exam_mode", responseOrigin);
  }
  const examMode = mode ?? "MCQ";

  const { data: plugin, error: pluginError } = await serviceClient
    .from("amc_plugin_version")
    .select("id,plugin_code,plugin_version,status,contract_version,blueprint_version,taxonomy_version,environment_version,target_version")
    .eq("plugin_code", "AMC")
    .eq("plugin_version", "1.0.0")
    .maybeSingle();

  if (pluginError) return errorResponse(500, "amc_plugin_query_failed", responseOrigin);
  if (!plugin) return errorResponse(404, "amc_plugin_unavailable", responseOrigin);

  if (action === "get_readiness") {
    const { data, error } = await userClient.rpc("rebuild_my_amc_readiness", {
      p_exam_mode: examMode,
    });
    if (error) return errorResponse(500, "readiness_evaluation_failed", responseOrigin);
    const safeDTO = readinessDTO(data);
    if (!safeDTO) return errorResponse(500, "readiness_response_invalid", responseOrigin);
    return json(safeDTO, 200, responseOrigin);
  }

  if (action === "get_summary") {
    const { data: environment, error } = await serviceClient
      .from("amc_exam_environment_v1")
      .select("environment_code,environment_version,exam_mode,status")
      .eq("plugin_version_id", plugin.id)
      .eq("exam_mode", examMode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return errorResponse(500, "amc_environment_query_failed", responseOrigin);

    return json({
      plugin: "AMC",
      pluginVersion: plugin.plugin_version,
      status: plugin.status,
      environmentCode: environment?.environment_code ?? null,
      environmentVersion: environment?.environment_version ?? null,
      examMode,
      readiness: {
        probability: null,
        index: null,
        uncertainty: null,
        status: "INSUFFICIENT_EVIDENCE",
        probabilityStatus: "NOT_CALIBRATED",
      },
    }, 200, responseOrigin);
  }

  const { data, error } = await serviceClient
    .from("amc_blueprint")
    .select("exam_mode,patient_group,task_domain,proportion,item_target")
    .eq("plugin_version_id", plugin.id)
    .eq("exam_mode", examMode);

  if (error) return errorResponse(500, "blueprint_query_failed", responseOrigin);
  return json({
    plugin: "AMC",
    pluginVersion: plugin.plugin_version,
    examMode,
    blueprint: data ?? [],
  }, 200, responseOrigin);
});
