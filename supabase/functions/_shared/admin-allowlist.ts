// Pure admin check core (no Deno globals / npm imports: also runs under vitest).
// Admin = public.is_admin(); super_admin = public.is_super_admin() (role column on pie.security_admin_allowlist).
// Both are SECURITY DEFINER and match user_id = auth.uid() + confirmed lower-cased JWT email + enabled.
// ANY error (no bearer, rpc error, throw, non-true result) => not admin / not super_admin (fail CLOSED).
import { normaliseEmail } from "./admin-gate.ts";

export interface AdminRowResult {
  data: { email: string; role: "super_admin" | "admin" } | null;
  error: unknown;
}
export type BoolRpc = () => Promise<{ data: unknown; error: unknown }>;

async function strictTrue(rpc: BoolRpc): Promise<{ ok: boolean; error: unknown }> {
  try {
    const { data, error } = await rpc();
    if (error) return { ok: false, error };
    return { ok: data === true, error: null };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/** Drop-in for the old `admin_roles` `{ data, error }` lookup. Role comes from the DB; data null unless is_admin() is true. */
export async function resolveAdminRow(isAdminRpc: BoolRpc, isSuperAdminRpc: BoolRpc, email: unknown): Promise<AdminRowResult> {
  const e = normaliseEmail(email);
  if (!e) return { data: null, error: null };
  const admin = await strictTrue(isAdminRpc);
  if (!admin.ok) return { data: null, error: admin.error };
  // A failed super check degrades to plain admin (never escalates).
  const sup = await strictTrue(isSuperAdminRpc);
  if (sup.error) console.error("[admin-allowlist] is_super_admin check failed (treating as plain admin):", sup.error);
  return { data: { email: e, role: sup.ok ? "super_admin" : "admin" }, error: null };
}
