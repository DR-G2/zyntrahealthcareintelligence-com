// Pure audit helpers (no Deno globals, no npm imports): run under vitest and Deno. Reusable by P5.

/** Keys stripped (case-insensitive, at any depth) from audit snapshots. */
export const PII_KEYS = ["email", "name", "display_name", "full_name", "phone", "ip", "ip_address", "user_agent"] as const;
const PII = new Set<string>(PII_KEYS);

/** Deep copy of `value` with every PII key removed from every nested object/array. */
export function stripPii(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPii);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!PII.has(k.toLowerCase())) out[k] = stripPii(v);
    }
    return out;
  }
  return value;
}

/** Canonical form of an audit target before hashing: trimmed + lower-cased uuid or email. */
export function normaliseTarget(raw: string): string {
  return raw.trim().toLowerCase();
}

/** HMAC-SHA256(key, normaliseTarget(target)) as lowercase hex (Web Crypto: Deno + Node 20). */
export async function hmacTarget(key: string, target: string): Promise<string> {
  if (!key) throw new Error("audit HMAC key missing");
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(normaliseTarget(target)));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type AuditStatus = "pending" | "done" | "failed";
/** Log-safe error descriptor: stage + code only (never messages, which can echo emails/keys). */
export function errCode(err: unknown): string {
  const e = err as { code?: unknown; status?: unknown } | null;
  return String(e?.code ?? e?.status ?? "unknown");
}
