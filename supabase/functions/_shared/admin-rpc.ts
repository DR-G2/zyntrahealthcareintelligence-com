// Edge wrapper: calls public.is_admin() / public.is_super_admin() AS THE CALLER (their JWT + anon key).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { type AdminRowResult, type BoolRpc, resolveAdminRow } from "./admin-allowlist.ts";

export function callerRpc(authHeader: string | null | undefined, fn: "is_admin" | "is_super_admin"): BoolRpc {
  return async () => {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return { data: false, error: "missing bearer token" };
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) return { data: false, error: "SUPABASE_URL / SUPABASE_ANON_KEY not set" };
    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    return await client.rpc(fn);
  };
}

/** Replacement for the old admin_roles select/eq(email)/maybeSingle lookup; role from the DB; fails CLOSED. */
export function adminRoleRow(req: Request, email: unknown): Promise<AdminRowResult> {
  const h = req.headers.get("Authorization");
  return resolveAdminRow(callerRpc(h, "is_admin"), callerRpc(h, "is_super_admin"), email);
}
