// Admin checks via the DB RPCs public.is_admin(_email text default null) and public.is_super_admin()
// (migrations 20261014051000 / 20261014071000). Both read auth.uid() + the JWT email, so they MUST be
// called with a client carrying the CALLER's JWT (never the service role, which would always be false).
// Callers must fail closed: any `error` (incl. 42883 undefined_function, 42P01 undefined_table) or a
// result that is not exactly `true` is a 403.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

export type AdminRpc = "is_admin" | "is_super_admin";
export interface AdminRpcError { code: string; message: string }
export interface AdminRpcResult { data: boolean | null; error: AdminRpcError | null }

/** `jwt` may be the bare token or a full "Bearer <token>" header value. */
export async function adminRpc(jwt: string | null | undefined, fn: AdminRpc): Promise<AdminRpcResult> {
  const bare = (jwt ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bare) return { data: null, error: { code: "no_jwt", message: "missing caller JWT" } };
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return { data: null, error: { code: "no_env", message: "SUPABASE_URL/SUPABASE_ANON_KEY not set" } };
  try {
    const client = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${bare}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = fn === "is_admin"
      ? await client.rpc("is_admin", { _email: null })
      : await client.rpc("is_super_admin");
    if (error) return { data: null, error: { code: String(error.code ?? "rpc_error"), message: String(error.message ?? "") } };
    if (data === null || data === undefined) return { data: null, error: { code: "null_result", message: `${fn} returned null` } };
    return { data: data === true, error: null };
  } catch (e) {
    return { data: null, error: { code: "exception", message: e instanceof Error ? e.message : String(e) } };
  }
}
