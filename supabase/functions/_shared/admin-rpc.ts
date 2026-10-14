// Edge wrapper: calls public.is_admin() AS THE CALLER (their JWT + anon key), so auth.uid()/auth.jwt() are theirs.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { type AdminRowResult, resolveAdminRow, superAdminEmails } from "./admin-allowlist.ts";

export function callerIsAdminRpc(authHeader: string | null | undefined) {
  return async () => {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return { data: false, error: "missing bearer token" };
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) return { data: false, error: "SUPABASE_URL / SUPABASE_ANON_KEY not set" };
    const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    return await client.rpc("is_admin");
  };
}

/** Replacement for the old admin_roles select/eq(email)/maybeSingle lookup; fails CLOSED. */
export function adminRoleRow(req: Request, email: unknown): Promise<AdminRowResult> {
  return resolveAdminRow(callerIsAdminRpc(req.headers.get("Authorization")), email, superAdminEmails(Deno.env.get("SUPER_ADMIN_EMAILS")));
}
