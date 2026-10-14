// Pure admin check core (no Deno globals / npm imports: also runs under vitest).
// Admin = public.is_admin() (PR #87): SECURITY DEFINER over pie.security_admin_allowlist, matching
// user_id = auth.uid() AND the caller's confirmed, lower-cased JWT email, enabled = true.
// The allowlist has no role tier, so "super_admin" = admin AND email listed in env SUPER_ADMIN_EMAILS
// (comma-separated). Unset/empty SUPER_ADMIN_EMAILS => nobody is super_admin (fail CLOSED).
// ANY error (no bearer, rpc error, throw, non-true result) => not admin.
import { normaliseEmail } from "./admin-gate.ts";

export interface AdminRowResult {
  data: { email: string; role: "super_admin" | "admin" } | null;
  error: unknown;
}
export type IsAdminRpc = () => Promise<{ data: unknown; error: unknown }>;

export function superAdminEmails(raw: string | null | undefined): string[] {
  return (raw ?? "").split(",").map((s) => normaliseEmail(s)).filter((s): s is string => !!s);
}

/** Drop-in for the old `admin_roles` `{ data, error }` lookup: data is null unless is_admin() returned exactly true. */
export async function resolveAdminRow(rpc: IsAdminRpc, email: unknown, superEmails: readonly string[]): Promise<AdminRowResult> {
  const e = normaliseEmail(email);
  if (!e) return { data: null, error: null };
  try {
    const { data, error } = await rpc();
    if (error) return { data: null, error };
    if (data !== true) return { data: null, error: null };
    return { data: { email: e, role: superEmails.includes(e) ? "super_admin" : "admin" }, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}
