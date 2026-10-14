// Pure audit helpers (no Deno globals, no npm imports): run under vitest and Deno. Reusable by P5.

/** Any of these tokens in a key (split on _ - and camelCase) strips it, unless the exact key is allowlisted. */
export const PII_TOKENS = new Set([
  "email", "phone", "mobile", "name", "firstname", "lastname", "username", "ip", "ipaddr",
  "address", "dob", "birth", "birthdate", "useragent",
]);
/** Whole-key (normalised: lowercase, separators removed) matches that always strip. */
const PII_WHOLE = new Set(["useragent", "ipaddress", "displayname"]);
/** Exact-key allowlist (only these survive a token hit). display_name is deliberately NOT here. */
export const PII_KEY_ALLOWLIST = new Set(["subject_name", "lo_name", "topic_name", "file_name"]);

export function keyTokens(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()
    .split(/[_\-\s.]+/)
    .filter(Boolean);
}

export function isPiiKey(key: string): boolean {
  if (PII_KEY_ALLOWLIST.has(key)) return false;
  const whole = key.toLowerCase().replace(/[_\-\s.]/g, "");
  if (PII_WHOLE.has(whole)) return true;
  return keyTokens(key).some((t) => PII_TOKENS.has(t)); // fail-safe: token hit + not allowlisted = strip
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// AU/IN numbers: +61/+91 (or 61/91 WITH a separator). Never bare digit strings (epochs, order refs).
const INTL_PHONE_RE = /^\+?(61|91)[\s-]?\d[\d\s-]{7,12}$/;
// Clearly formatted local numbers: (02) 9999 9999, 0412 345 678, 98765-43210. Must contain a separator.
const LOCAL_PHONE_RE = /^\(?0?\d{2,5}\)?[\s-]\d{3,5}[\s-]?\d{3,5}$/;
export const REDACTED = "[redacted]";

/** True for a phone-looking string. Bare digit strings are never treated as phones. */
export function looksLikePhone(v: string): boolean {
  const s = v.trim();
  if (/^\d+$/.test(s)) return false;
  if (INTL_PHONE_RE.test(s) && (s.startsWith("+") || /[\s-]/.test(s))) return true;
  return LOCAL_PHONE_RE.test(s);
}

/** Redacts emails inside a string, and the whole string if it is a phone number. */
export function redactText(v: string): string {
  if (looksLikePhone(v)) return REDACTED;
  return v.replace(EMAIL_RE, REDACTED);
}

/** Deep copy with PII keys removed and PII values redacted at every depth (objects + arrays). */
export function stripPii(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(stripPii);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!isPiiKey(k)) out[k] = stripPii(v);
    }
    return out;
  }
  return value;
}

/** Free-text reason: same value redaction (emails/phones). */
export function redactReason(reason: string | null | undefined): string | null {
  return reason == null ? null : redactText(String(reason));
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
