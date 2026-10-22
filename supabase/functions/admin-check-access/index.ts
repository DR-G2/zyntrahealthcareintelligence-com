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
  ...(origin && allowedOrigins.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" }
    : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
});
const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = headersFor(origin);
  if (origin && !allowedOrigins.includes(origin)) {
    return reply({ error: "Origin not allowed" }, 403, headers);
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405, headers);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return reply({ error: "Server configuration unavailable" }, 500, headers);

    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Unauthorized" }, 401, headers);

    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: "Unauthorized" }, 401, headers);

    const { data: role, error: roleError } = await db.schema("command").from("admin_roles")
      .select("role").eq("user_id", auth.user.id).eq("active", true).maybeSingle();
    if (roleError) {
      console.error("admin-check-access role lookup failed", roleError);
      return reply({ error: "Admin authorization could not be verified" }, 500, headers);
    }

    const isAdmin = !!role && ["admin", "super_admin", "super-admin"].includes(String(role.role).toLowerCase());
    if (!isAdmin) return reply({ is_admin: false }, 403, headers);
    return reply({ is_admin: true, role: role.role }, 200, headers);
  } catch (error) {
    console.error("admin-check-access unexpected failure", error);
    return reply({ error: "Internal admin access service error" }, 500, headers);
  }
});
