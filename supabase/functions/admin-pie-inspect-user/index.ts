import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const headers = corsHeaders;

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await admin
      .from("admin_roles")
      .select("role")
      .ilike("email", userData.user.email)
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }

    // Core PIE state is required. Secondary inspection panels are deliberately
    // best-effort so a newly-added/optional PIE table cannot blank the entire
    // admin inspection surface.
    const stateRes = await admin
      .from("pie_candidate_state")
      .select("*")
      .eq("user_id", user_id)
      .order("state_sequence", { ascending: false })
      .limit(1)
      .maybeSingle();

    // A missing PIE table (not yet migrated) must not produce a generic 500;
    // report it as an inspection warning and return an empty state instead.
    const stateError = stateRes.error;
    if (stateError) {
      console.warn("[PIE admin inspect] candidate_state query failed:", stateError.message);
    }

    const stateId = stateError ? undefined : stateRes.data?.id;

    const [
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
      stateId
        ? admin.from("pie_state_uncertainty").select("*").eq("candidate_state_id", stateId)
        : Promise.resolve({ data: [], error: null }),
      admin.from("pie_dynamic_state").select("*").eq("user_id", user_id).order("state_sequence", { ascending: false }).limit(1).maybeSingle(),
      admin.from("pie_exam_readiness").select("*, pie_exam_environment(exam_code, exam_version, status)").eq("user_id", user_id).order("evaluated_at", { ascending: false }).limit(5),
      admin.from("pie_legacy_compatibility").select("*").eq("user_id", user_id).maybeSingle(),
      admin.from("pie_hypothesis").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(20),
      admin.from("pie_dwig_selection").select("*, pie_dwig_candidate(*)").eq("user_id", user_id).order("evaluated_at", { ascending: false }).limit(5),
      admin.from("pie_decision").select("*").eq("user_id", user_id).order("decided_at", { ascending: false }).limit(5),
      admin.from("pie_validation_run").select("*").order("created_at", { ascending: false }).limit(10),
      admin.from("pie_inference_run").select("*").eq("user_id", user_id).order("started_at", { ascending: false }).limit(20),
    ]);

    const optionalErrors = [
      stateError,
      uncertaintyRes.error, dynamicRes.error, readinessRes.error,
      compatibilityRes.error, hypothesesRes.error, dwigRes.error,
      decisionRes.error, validationRes.error, inferenceRes.error,
    ].filter(Boolean);

    if (optionalErrors.length) {
      console.warn("[PIE admin inspect] optional query failures:",
        optionalErrors.map((e: any) => e?.message).filter(Boolean));
    }

    return new Response(JSON.stringify({
      inspected_user_id: user_id,
      candidate_state: stateError ? null : stateRes.data,
      state_uncertainty: uncertaintyRes.data || [],
      dynamic_state: dynamicRes.data || null,
      exam_readiness: readinessRes.data || [],
      legacy_compatibility: compatibilityRes.data || null,
      hypotheses: hypothesesRes.data || [],
      dwig_selections: dwigRes.data || [],
      decisions: decisionRes.data || [],
      validation_runs: validationRes.data || [],
      inference_runs: inferenceRes.data || [],
      inspection_warnings: optionalErrors.map((e: any) => e?.message).filter(Boolean),
    }), { headers: { ...headers, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
