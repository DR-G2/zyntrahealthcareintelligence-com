import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("AMC_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function publicPluginDto(row: any) {
  return {
    pluginKey: row.plugin_key,
    pluginVersion: row.plugin_version,
    examCode: row.exam_code,
    status: row.status,
    contractVersion: row.contract_version,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "server_configuration_error" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = body?.action ?? "status";

  const { data: plugin, error: pluginError } = await serviceClient
    .from("amc_plugin_version")
    .select("plugin_key,plugin_version,exam_code,status,contract_version")
    .eq("plugin_key", "AMC_EXAM_INTELLIGENCE")
    .eq("plugin_version", "1.0.0")
    .maybeSingle();

  if (pluginError || !plugin) return json({ error: "plugin_not_configured" }, 503);

  if (action === "status") {
    return json({ plugin: publicPluginDto(plugin), environment: "AMC_MCQ", readiness: "NOT_READY_FOR_INFERENCE" });
  }

  if (action === "readiness") {
    return json({
      plugin: publicPluginDto(plugin),
      readiness: {
        status: "NOT_READY_FOR_INFERENCE",
        reason: "AMC_PLUGIN_V1_REQUIRES_VALIDATED_ENVIRONMENT_AND_SOURCE_BACKED_CONFIGURATION",
      },
    });
  }

  if (action === "record_outcome") {
    const environmentKey = body?.environment_key;
    const actionType = body?.action_type;
    const observedOutcome = body?.observed_outcome;
    if (!environmentKey || !["QUESTION","TASK","INTERVENTION"].includes(actionType) || !observedOutcome) {
      return json({ error: "invalid_outcome_payload" }, 400);
    }

    const { data: environment, error: envError } = await serviceClient
      .from("amc_exam_environment")
      .select("id")
      .eq("environment_key", environmentKey)
      .eq("plugin_version_id", plugin.id)
      .maybeSingle();

    if (envError || !environment) return json({ error: "environment_not_found" }, 404);

    const { data: outcome, error: outcomeError } = await serviceClient
      .from("amc_intervention_outcome_event")
      .insert({
        user_id: user.id,
        plugin_version_id: plugin.id,
        environment_id: environment.id,
        action_type: actionType,
        outcome_definition: body?.outcome_definition ?? {},
        observed_outcome: observedOutcome,
        pre_uncertainty: body?.pre_uncertainty ?? null,
        post_uncertainty: body?.post_uncertainty ?? null,
        causal_status: "OBSERVATIONAL",
      })
      .select("id")
      .single();

    if (outcomeError) return json({ error: "outcome_record_failed" }, 500);

    await serviceClient.from("amc_learning_update").insert({
      user_id: user.id,
      plugin_version_id: plugin.id,
      source_outcome_id: outcome.id,
      update_type: "OBSERVATION_ONLY",
      evidence: { source: "amc-plugin-v1", causal_status: "OBSERVATIONAL" },
      applied: false,
    });

    return json({ recorded: true, outcome_id: outcome.id, learning_update: "OBSERVATION_ONLY" });
  }

  return json({ error: "unsupported_action" }, 400);
});
