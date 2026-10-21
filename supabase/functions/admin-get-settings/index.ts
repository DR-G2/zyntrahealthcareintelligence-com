import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const fallbackOrigins = [
  "https://www.zyntrahealthcareintelligence.com",
  "https://zyntrahealthcareintelligence.com",
  "https://www.zyntrahealthcareintelligence.app",
  "https://zyntrahealthcareintelligence.app",
  "https://www.zyntrahealthcareintelligence.org",
  "https://zyntrahealthcareintelligence.org",
];
const allowedOrigins = (Deno.env.get("ADMIN_ALLOWED_ORIGIN") ?? fallbackOrigins.join(","))
  .split(",").map((value) => value.trim()).filter(Boolean);
const headersFor = (origin: string | null) => ({
  ...(origin && allowedOrigins.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});
const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = headersFor(origin);
  if (origin && !allowedOrigins.includes(origin)) return reply({ error: "Origin not allowed" }, 403, headers);
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
      .select("role").eq("user_id", auth.user.id).eq("active", true).in("role", ["admin", "super_admin", "super-admin"]).maybeSingle();
    if (roleError) {
      console.error("settings role lookup failed", roleError);
      return reply({ error: "Admin authorization could not be verified" }, 500, headers);
    }
    if (!role) return reply({ error: "Forbidden" }, 403, headers);
    const { data, error } = await db.from("site_settings").select("setting_key,setting_value,is_public,updated_at").order("setting_key");
    if (error) {
      console.error("settings read failed", error);
      return reply({ error: "Settings source could not be read" }, 500, headers);
    }
    const { data: audit, error: auditError } = await db.schema("command").from("admin_activity_logs")
      .select("target_id,actor_user_id,created_at").eq("action", "site_setting_updated").order("created_at", { ascending: false }).limit(100);
    if (auditError) {
      console.error("settings audit lookup failed", auditError);
      return reply({ error: "Settings audit history could not be read" }, 500, headers);
    }
    const latest: Record<string, { updated_by: string; updated_at: string }> = {};
    for (const entry of audit ?? []) if (entry.target_id && !latest[entry.target_id]) latest[entry.target_id] = { updated_by: entry.actor_user_id, updated_at: entry.created_at };
    return reply({ settings: data ?? [], audit: latest }, 200, headers);
  } catch (e) {
    console.error("admin-get-settings unexpected failure", e);
    return reply({ error: "Internal settings service error" }, 500, headers);
  }
});
