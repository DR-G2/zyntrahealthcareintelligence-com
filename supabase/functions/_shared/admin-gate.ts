// Pure admin-gate helpers shared by admin edge functions (no Deno globals: also run under vitest).
//
// Email comparison is lower-case on BOTH sides: the caller's JWT email is trimmed + lower-cased
// before the exact .eq lookup, and the returned admin_roles.email is trimmed + lower-cased again
// before comparing. The stored side is kept lower-case by the legacy CHECK constraint
// admin_roles_email_lowercase (supabase/legacy_pending/20261007_legacy_admin_roles_email_lowercase.sql);
// a mixed-case row that predates it fails CLOSED (no match), never open. No LIKE/ilike anywhere.

export type AdminRole = "super_admin" | "admin";
export interface AdminRow { email?: unknown; role?: unknown }

export function normaliseEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.length > 3 && e.includes("@") ? e : null;
}

/** Exact (not LIKE) match: the row must exist and its lower-cased email must equal the lower-cased caller. */
export function isExactAdminRow(row: AdminRow | null | undefined, callerEmail: string | null): boolean {
  const caller = normaliseEmail(callerEmail);
  return Boolean(row && caller && normaliseEmail(row.email) === caller);
}

/** Exact email match AND the row's role is one of `roles`. */
export function hasAdminRole(row: AdminRow | null | undefined, callerEmail: string | null, roles: readonly AdminRole[]): boolean {
  return isExactAdminRow(row, callerEmail) && typeof row?.role === "string" && (roles as readonly string[]).includes(row.role);
}

// ── CORS: app origins only ───────────────────────────────────────────────────────────────────
export const DEFAULT_ADMIN_ORIGINS = [
  "https://www.zyntrahealthcareintelligence.com",
  "https://zyntrahealthcareintelligence.com",
] as const;

/** Comma-separated ADMIN_ALLOWED_ORIGINS (or legacy single ADMIN_ALLOWED_ORIGIN); "*" is never accepted. */
export function parseAllowedOrigins(raw: string | null | undefined): string[] {
  const list = (raw ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter((s) => /^https?:\/\/[^*\s/]+$/.test(s));
  return list.length ? list : [...DEFAULT_ADMIN_ORIGINS];
}

export const ADMIN_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/** Reflects the request Origin only if it is an allowed app origin; otherwise pins the first app origin. */
export function adminCorsHeaders(requestOrigin: string | null | undefined, allowed: readonly string[]): Record<string, string> {
  const origin = requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : allowed[0];
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": ADMIN_ALLOW_HEADERS, "Vary": "Origin" };
}
