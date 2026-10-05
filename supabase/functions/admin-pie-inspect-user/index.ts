import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigin = Deno.env.get("PIE_ALLOWED_ORIGIN");
const allowedOrigins = new Set([
  "https://www.zyntrahealthcareintelligence.com",
  "https://zyntrahealthcareintelligence.com",
  ...(configuredOrigin ? configuredOrigin.split(",").map((value) => value.trim()).filter(Boolean) : []),
]);

const corsHeaders = (origin?: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
    ? origin
    : "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...headers, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);

    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await admin
      .from("admin_roles")
      .select("role")
      .ilike("email", userData.user.email)
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [
      stateRes,
      uncertaintyRes,
      dynamicRes,
      readinessRes,
      compatibilityRes,
      hypothesesRes,
      dwigRes,
      decisionRes,
      validationRes,
      inferenceRes,
    ] = await Promise.all([
      admin.from("pie_candidate_state").select("*").eq("user_id", user_id).order("state_sequence", { ascending: false }).limit(1).maybeSingle(),
      admin.from("pie_state_uncertainty").select("*").in(
        "candidate_state_id",
        (await admin.from("pie_candidate_state").select("id").eq("user_id", user_id).order("state_sequence", { ascending: false }).limit(1)).data?.map((x: any) => x.id) || ["00000000-0000-0000-0000-000000000000"]
      ),
      admin.from("pie_dynamic_state").select("*").eq("user_id", user_id).order("state_sequence", { ascending: false }).limit(1).maybeSingle(),
      admin.from("pie_exam_readiness").select("*, pie_exam_environment(exam_code, exam_version, status)").eq("user_id", user_id).order("evaluated_at", { ascending: false }).limit(5),
      admin.from("pie_legacy_compatibility").select("*").eq("user_id", user_id).maybeSingle(),
      admin.from("pie_hypothesis").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(20),
      admin.from("pie_dwig_selection").select("*, pie_dwig_candidate(*)").eq("user_id", user_id).order("evaluated_at", { ascending: false }).limit(5),
      admin.from("pie_decision").select("*").eq("user_id", user_id).order("decided_at", { ascending: false }).limit(5),
      admin.from("pie_validation_run").select("*").order("created_at", { ascending: false }).limit(10),
      admin.from("pie_inference_run").select("*").eq("user_id", user_id).order("started_at", { ascending: false }).limit(20),
    ]);

    const errors = [
      stateRes.error, uncertaintyRes.error, dynamicRes.error, readinessRes.error,
      compatibilityRes.error, hypothesesRes.error, dwigRes.error, decisionRes.error, validationRes.error, inferenceRes.error,
    ].filter(Boolean);

    if (errors.length) {
      return new Response(JSON.stringify({ error: errors[0]?.message || "PIE inspection query failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      inspected_user_id: user_id,
      candidate_state: stateRes.data,
      state_uncertainty: uncertaintyRes.data || [],
      dynamic_state: dynamicRes.data,
      exam_readiness: readinessRes.data || [],
      legacy_compatibility: compatibilityRes.data,
      hypotheses: hypothesesRes.data || [],
      dwig_selections: dwigRes.data || [],
      decisions: decisionRes.data || [],
      validation_runs: validationRes.data || [],
      inference_runs: inferenceRes.data || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
