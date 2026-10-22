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
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply({ error: "Server configuration unavailable" }, 500);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Unauthorized" }, 401);
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: "Unauthorized" }, 401);
    const { data: role, error: roleError } = await db.schema("command").from("admin_roles")
      .select("role").eq("user_id", auth.user.id).eq("active", true).maybeSingle();
    if (roleError) { console.error("admin-list-users role lookup failed", roleError); return reply({ error: "Admin authorization could not be verified" }, 500); }
    if (!role || !["admin", "super_admin", "super-admin"].includes(String(role.role).toLowerCase())) return reply({ error: "Forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const page = Math.min(100000, Math.max(1, Number.isInteger(body.page) ? body.page : 1));
    const pageSize = Math.min(100, Math.max(1, Number.isInteger(body.page_size) ? body.page_size : 50));
    const from = (page - 1) * pageSize;
    const { data: profiles, error, count } = await db.from("profiles")
      .select("id,email,display_name,created_at,role,status", { count: "exact" })
      .order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    if (error) { console.error("admin-list-users profiles query failed", error); return reply({ error: "Candidate directory query failed" }, 500); }
    const users = (profiles ?? []).map(p => ({
      id: p.id, email: p.email ?? "", name: p.display_name ?? "", created_at: p.created_at,
      role: p.role ?? null, status: p.status ?? null, subscription: null, override: null, presence: null,
    }));
    return reply({ users, total_count: count ?? 0, page, page_size: pageSize, optional_data_available: false });
  } catch (e) {
    console.error("admin-list-users unexpected failure", e);
    return reply({ error: "Internal candidate directory service error" }, 500);
  }
});
