import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const origin = Deno.env.get("PIE_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !key || !auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });

  const admin = createClient(url, key);
  const token = auth.replace("Bearer ", "");
  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData.user?.email) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });

  const { data: role } = await admin.from("admin_roles").select("role").ilike("email", userData.user.email).maybeSingle();
  if (!role) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers });

  const body = await req.json().catch(() => ({}));
  const modelVersion = String(body.model_version ?? "");
  const validationRunId = String(body.validation_run_id ?? "");
  if (!modelVersion || !validationRunId) return new Response(JSON.stringify({ error: "model_version and validation_run_id required" }), { status: 400, headers });

  const { data: gate } = await admin.from("pie_certification_gate")
    .select("*")
    .eq("model_version", modelVersion)
    .eq("validation_run_id", validationRunId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return new Response(JSON.stringify({
    model_version: modelVersion,
    validation_run_id: validationRunId,
    certification: gate ?? null,
    promotion_allowed: gate?.status === "PASSED" && gate?.certification_level === "LEVEL_2_DECISION",
    automatic_promotion: false,
    legacy_readiness_authoritative: true,
  }), { headers });
});
