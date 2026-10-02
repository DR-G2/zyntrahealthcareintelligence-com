import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

export interface Caller {
  userId: string;
  email: string | null;
}

/** Validates the bearer token. Returns the caller, or a 401 Response. */
export async function requireUser(req: Request): Promise<Caller | Response> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = header.slice(7);
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getClaims(token);
  const sub = data?.claims?.sub as string | undefined;
  if (error || !sub || data?.claims?.role !== "authenticated") return json({ error: "Unauthorized" }, 401);
  return { userId: sub, email: (data.claims.email as string | undefined) ?? null };
}

export async function isAdmin(email: string | null): Promise<boolean> {
  if (!email) return false;
  const { data } = await serviceClient().from("admin_roles").select("id").eq("email", email).maybeSingle();
  return !!data;
}

/** Validates the bearer token and requires an admin_roles entry. */
export async function requireAdmin(req: Request): Promise<Caller | Response> {
  const caller = await requireUser(req);
  if (caller instanceof Response) return caller;
  if (!(await isAdmin(caller.email))) return json({ error: "Forbidden" }, 403);
  return caller;
}

/** True when the caller has an active paid payment or a live manual override. */
export async function hasPaidAccess(userId: string): Promise<boolean> {
  const sb = serviceClient();
  const nowIso = new Date().toISOString();
  const [{ data: pay }, { data: ov }] = await Promise.all([
    sb.from("payments").select("id").eq("user_id", userId).eq("status", "active").limit(1),
    sb.from("manual_overrides").select("id, expires_at").eq("user_id", userId),
  ]);
  if (pay && pay.length) return true;
  return (ov ?? []).some((o: { expires_at: string | null }) => !o.expires_at || o.expires_at > nowIso);
}

/** Keeps only user/assistant chat turns with string content, so callers cannot inject system instructions. */
export function sanitizeChat(messages: unknown, maxMessages = 40, maxLen = 8000) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-maxMessages)
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, maxLen) }));
}

/** Restricts a free-text value to a short, plain label before it is placed in a prompt. */
export function safeLabel(value: unknown, fallback: string, maxLen = 60): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[^\p{L}\p{N} &/,.()'-]/gu, "").trim().slice(0, maxLen);
  return cleaned || fallback;
}

/** Allows trusted server-to-server calls made with the service key, otherwise requires an admin. */
export async function requireAdminOrService(req: Request): Promise<Caller | "service" | Response> {
  const header = req.headers.get("Authorization") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (key && header === `Bearer ${key}`) return "service";
  return await requireAdmin(req);
}
