import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": Deno.env.get("ADMIN_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply({ error: "Server configuration unavailable" }, 500);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Unauthorized" }, 401);
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: "Unauthorized" }, 401);
    const { data: role, error: roleError } = await db.schema("command").from("admin_roles")
      .select("role").eq("user_id", auth.user.id).eq("active", true).maybeSingle();
    if (roleError) { console.error("settings role lookup failed", roleError); return reply({ error: "Admin authorization could not be verified" }, 500); }
    if (!role || !["admin", "super_admin", "super-admin"].includes(String(role.role).toLowerCase())) return reply({ error: "Forbidden" }, 403);
    const { data, error } = await db.from("site_settings").select("setting_key,setting_value,is_public,updated_at").order("setting_key");
    if (error) { console.error("settings read failed", error); return reply({ error: "Settings source could not be read" }, 500); }
    const { data: audit, error: auditError } = await db.schema("command").from("admin_activity_logs")
      .select("target_id,actor_user_id,created_at").eq("action", "site_setting_updated").order("created_at", { ascending: false }).limit(100);
    if (auditError) { console.error("settings audit lookup failed", auditError); return reply({ error: "Settings audit history could not be read" }, 500); }
    const latest: Record<string, { updated_by: string; updated_at: string }> = {};
    for (const entry of audit ?? []) if (entry.target_id && !latest[entry.target_id]) latest[entry.target_id] = { updated_by: entry.actor_user_id, updated_at: entry.created_at };
    return reply({ settings: data ?? [], audit: latest });
  } catch (e) {
    console.error("admin-get-settings unexpected failure", e);
    return reply({ error: "Internal settings service error" }, 500);
  }
});
