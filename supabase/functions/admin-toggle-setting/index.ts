import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedKeys = new Set(["show_about_pricing", "maintenance_mode", "registration_open", "osce_enabled", "mcq_temp_enabled"]);
const configuredOrigins = (Deno.env.get("ADMIN_ALLOWED_ORIGIN") ?? "https://www.zyntrahealthcareintelligence.com,https://zyntrahealthcareintelligence.com")
  .split(",").map((value) => value.trim()).filter(Boolean);
const headersFor = (origin: string | null) => ({
  ...(origin && configuredOrigins.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});
const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = headersFor(origin);
  if (origin && !configuredOrigins.includes(origin)) return reply({ error: "Origin not allowed" }, 403, headers);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405, headers);
  try {
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply({ error: "Server configuration unavailable" }, 500, headers);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\\s+/i, "");
    if (!token) return reply({ error: "Unauthorized" }, 401, headers);
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: "Unauthorized" }, 401, headers);
    const { data: role, error: roleError } = await db.schema("command").from("admin_roles")
      .select("role").eq("user_id", auth.user.id).eq("active", true).in("role", ["super_admin", "super-admin"]).maybeSingle();
    if (roleError) {
      console.error("setting role lookup failed", roleError);
      return reply({ error: "Admin authorization could not be verified" }, 500, headers);
    }
    if (!role) return reply({ error: "Super administrator access required" }, 403, headers);

    const body = await req.json().catch(() => null);
    const settingKey = body?.key;
    const value = body?.value;
    if (typeof settingKey !== "string" || !allowedKeys.has(settingKey)) return reply({ error: "Unsupported setting key" }, 400, headers);
    if (typeof value !== "boolean") return reply({ error: "Setting value must be boolean" }, 400, headers);

    // The database function commits the setting and its audit record in one transaction.
    const { data: setting, error } = await db.rpc("admin_update_site_setting_atomic", {
      p_actor_user_id: auth.user.id,
      p_actor_role: role.role,
      p_setting_key: settingKey,
      p_setting_value: value,
    });
    if (error || !setting) {
      console.error("atomic setting update failed", error);
      return reply({ error: "Setting was not changed. The atomic update and audit operation failed." }, 500, headers);
    }
    return reply({ setting, updated_by: auth.user.id }, 200, headers);
  } catch (e) {
    console.error("admin-toggle-setting unexpected failure", e);
    return reply({ error: "Internal settings service error" }, 500, headers);
  }
});
