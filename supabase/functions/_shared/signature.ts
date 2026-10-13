// HMAC-SHA256 signature helpers with constant-time comparison (no Deno-only APIs; unit-tested).

/** Constant-time string comparison: runtime depends only on the longer length, never on where bytes differ. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function hmacSha256Hex(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyHmacSignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!secret || typeof signature !== "string" || !signature) return false;
  return timingSafeEqual(await hmacSha256Hex(body, secret), signature.toLowerCase());
}
