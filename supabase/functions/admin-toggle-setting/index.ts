import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": Deno.env.get("ADMIN_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const allowedKeys = new Set(["show_about_pricing", "maintenance_mode", "registration_open", "osce_enabled", "mcq_temp_enabled"]);

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
    if (roleError) { console.error("setting role lookup failed", roleError); return reply({ error: "Admin authorization could not be verified" }, 500); }
    if (!role || !["super_admin", "super-admin"].includes(String(role.role).toLowerCase())) return reply({ error: "Super administrator access required" }, 403);

    const body = await req.json().catch(() => null);
    const settingKey = body?.key;
    const value = body?.value;
    if (typeof settingKey !== "string" || !allowedKeys.has(settingKey)) return reply({ error: "Unsupported setting key" }, 400);
    if (typeof value !== "boolean") return reply({ error: "Setting value must be boolean" }, 400);

    const { data: before, error: readError } = await db.from("site_settings")
      .select("setting_key,setting_value,is_public,updated_at").eq("setting_key", settingKey).maybeSingle();
    if (readError) { console.error("setting read failed", readError); return reply({ error: "Settings source could not be read" }, 500); }
    const previous = before?.setting_value ?? null;
    const { data: saved, error: writeError } = await db.from("site_settings").upsert({
      setting_key: settingKey, setting_value: value, is_public: settingKey === "show_about_pricing" || settingKey === "registration_open",
      updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" }).select("setting_key,setting_value,is_public,updated_at").single();
    if (writeError || !saved) { console.error("setting write failed", writeError); return reply({ error: "Setting could not be saved" }, 500); }

    const { error: auditError } = await db.schema("command").from("admin_activity_logs").insert({
      actor_user_id: auth.user.id, actor_role: role.role, action: "site_setting_updated",
      target_type: "site_setting", target_id: settingKey, reason: "Command Centre feature setting change",
      before_snapshot: { setting_key: settingKey, setting_value: previous },
      after_snapshot: { setting_key: settingKey, setting_value: saved.setting_value },
      status: "success",
    });
    if (auditError) {
      console.error("setting audit write failed", auditError);
      // Fail closed at the API boundary: report that the write occurred but was not audited.
      return reply({ error: "Setting was saved but audit logging failed; do not repeat the change. Contact an administrator." }, 500);
    }
    return reply({ setting: saved, updated_by: auth.user.id });
  } catch (e) {
    console.error("admin-toggle-setting unexpected failure", e);
    return reply({ error: "Internal settings service error" }, 500);
  }
});
