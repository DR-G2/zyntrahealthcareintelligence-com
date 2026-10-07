// Pure policy helpers (vitest + deno check).
export function normaliseEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.length > 3 && e.includes("@") ? e : null;
}
/** Exact (not LIKE) match: the admin_roles row must exist and its email must equal the caller's. */
export function isExactAdminRow(row: { email?: unknown } | null | undefined, callerEmail: string | null): boolean {
  return Boolean(row && callerEmail && normaliseEmail(row.email) === callerEmail);
}
export function clampPage(offset: unknown, limit: unknown): { from: number; to: number } {
  const o = Math.max(0, Math.floor(Number(offset) || 0));
  const l = Math.max(1, Math.min(1000, Math.floor(Number(limit) || 1000)));
  return { from: o, to: o + l - 1 };
}
