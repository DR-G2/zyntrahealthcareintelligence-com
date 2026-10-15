// Pure caller resolution for pie-telemetry-audit (no Deno/npm imports, so it is unit-testable).
// Each request is verified independently from its own Authorization header; nothing is cached
// between calls, so repeated audits in one session cannot be rejected by stale per-request state.
export interface ClaimsResult {
  data: { claims?: Record<string, unknown> } | null;
  error: { message?: string; code?: string } | null;
}
export type VerifyClaims = (token: string) => Promise<ClaimsResult>;

export type CallerResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401; error: "missing_authorization" | "unauthorized"; reason: string };

export async function resolveCaller(authorization: string | null, verify: VerifyClaims): Promise<CallerResult> {
  if (!authorization?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "missing_authorization", reason: "no_bearer" };
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return { ok: false, status: 401, error: "missing_authorization", reason: "empty_token" };
  const { data, error } = await verify(token);
  const claims = data?.claims;
  const sub = typeof claims?.sub === "string" ? claims.sub : null;
  if (error || !sub) {
    return { ok: false, status: 401, error: "unauthorized", reason: error?.code ?? error?.message ?? "no_subject" };
  }
  if (claims?.role !== "authenticated") return { ok: false, status: 401, error: "unauthorized", reason: "not_authenticated_role" };
  return { ok: true, userId: sub };
}
