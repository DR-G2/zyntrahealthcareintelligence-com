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
  if (!isRecord(value) || (value.examMode !== "MCQ" && value.examMode !== "CLINICAL")) return null;
  const dimensionCount = value.dimensionCount;
  return {
    plugin: "AMC",
    pluginVersion: typeof value.pluginVersion === "string" ? value.pluginVersion : "1.0.0",
    examMode: value.examMode,
    environmentCode: typeof value.environmentCode === "string" ? value.environmentCode : null,
    // No calibrated AMC pass-probability model is active. Do not expose the
    // engineering-only composite index or PIE uncertainty as candidate readiness.
    readiness: {
      probability: null,
      status: "INSUFFICIENT_EVIDENCE",
    },
    dimensionCount: Number.isInteger(dimensionCount) && (dimensionCount as number) >= 0
      ? dimensionCount : 0,
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
  if (!["get_summary", "get_blueprint", "get_readiness", "get_practice_status"].includes(String(action))) {
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

  if (action === "get_practice_status") {
    const { count: mappedCount, error: mappedError } = await serviceClient
      .from("amc_question_context")
      .select("id", { count: "exact", head: true })
      .eq("plugin_version_id", plugin.id)
      .eq("exam_mode", examMode);
    if (mappedError) return errorResponse(500, "amc_question_context_query_failed", responseOrigin);

    const { count: approvedCount, error: approvedError } = await serviceClient
      .from("amc_question_context")
      .select("id", { count: "exact", head: true })
      .eq("plugin_version_id", plugin.id)
      .eq("exam_mode", examMode)
      .eq("metadata->>review_status", "APPROVED")
      .not("metadata->>reviewed_by", "is", null)
      .not("metadata->>reviewed_at", "is", null)
      .not("patient_group", "is", null)
      .or("clinical_domain.not.is.null,task_type.not.is.null")
      .not("amc_relevance", "is", null)
      .not("source_evidence_level", "is", null);
    if (approvedError) return errorResponse(500, "amc_question_context_query_failed", responseOrigin);

    return json({
      plugin: "AMC",
      pluginVersion: plugin.plugin_version,
      examMode,
      mappedQuestionCount: mappedCount ?? 0,
      approvedQuestionCount: approvedCount ?? 0,
      mappingStatus: (approvedCount ?? 0) > 0 ? "REVIEWED_METADATA_PRESENT" : "MAPPING_REQUIRED",
      selectorStatus: "NOT_CERTIFIED",
      canStartAMCPractice: false,
      reason: "AMC question delivery remains disabled until approved question metadata and PIE blueprint-LO eligibility are both present and verified.",
    }, 200, responseOrigin);
  }

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
