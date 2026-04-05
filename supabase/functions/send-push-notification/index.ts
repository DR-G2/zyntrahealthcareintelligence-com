import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Web Push helpers (RFC 8291 / RFC 8188) ---
function base64UrlDecode(str: string): Uint8Array {
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createVapidAuthHeader(
  endpoint: string,
  vapidPrivateKeyBase64Url: string,
  vapidPublicKeyBase64Url: string,
  sub: string,
) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: now + 12 * 3600, sub };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import VAPID private key as ECDSA P-256
  const rawPrivate = base64UrlDecode(vapidPrivateKeyBase64Url);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: vapidPrivateKeyBase64Url,
    x: base64UrlEncode(base64UrlDecode(vapidPublicKeyBase64Url).slice(1, 33)),
    y: base64UrlEncode(base64UrlDecode(vapidPublicKeyBase64Url).slice(33, 65)),
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsignedToken),
  );

  // Convert DER-like signature from WebCrypto to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(sig);
  const token = `${unsignedToken}.${base64UrlEncode(sig)}`;

  return {
    authorization: `vapid t=${token}, k=${vapidPublicKeyBase64Url}`,
  };
}

async function encryptPayload(
  p256dhKey: string,
  authSecret: string,
  payload: string,
) {
  const clientPublicKey = base64UrlDecode(p256dhKey);
  const clientAuth = base64UrlDecode(authSecret);
  const enc = new TextEncoder();
  const plaintext = enc.encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // Derive shared secret via ECDH
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey },
    localKeyPair.privateKey,
    256,
  );

  // Generate 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF: auth_info = "WebPush: info\0" || client_public || server_public
  const authInfo = new Uint8Array([
    ...enc.encode("WebPush: info\0"),
    ...clientPublicKey,
    ...new Uint8Array(localPublicKeyRaw),
  ]);

  // PRK = HKDF-Extract(auth_secret, shared_secret)
  const authKey = await crypto.subtle.importKey("raw", clientAuth, { name: "HKDF" }, false, [
    "deriveBits",
  ]);

  // IKM via HKDF
  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, [
    "deriveBits",
  ]);

  const ikm = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: clientAuth,
      info: authInfo,
    },
    ikmKey,
    256,
  );

  // CEK info
  const cekInfo = new Uint8Array([...enc.encode("Content-Encoding: aes128gcm\0")]);
  const nonceInfo = new Uint8Array([...enc.encode("Content-Encoding: nonce\0")]);

  const ikmCryptoKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, [
    "deriveBits",
  ]);

  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    ikmCryptoKey,
    128,
  );

  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    ikmCryptoKey,
    96,
  );

  // Pad plaintext: add delimiter byte 0x02
  const paddedPlaintext = new Uint8Array([...plaintext, 2]);

  // Encrypt with AES-128-GCM
  const cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonceBits },
    cek,
    paddedPlaintext,
  );

  // aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid(65) || encrypted
  const rs = new ArrayBuffer(4);
  new DataView(rs).setUint32(0, 4096);
  const localPubBytes = new Uint8Array(localPublicKeyRaw);

  const header = new Uint8Array([
    ...salt,
    ...new Uint8Array(rs),
    localPubBytes.byteLength,
    ...localPubBytes,
  ]);

  const body = new Uint8Array([...header, ...new Uint8Array(encrypted)]);
  return body;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidPublic = "BCnk82lMbi10ivT9iHyZig2cLLQbFx1tPa_x2vyy3OHnibwRvrVLqxhzMxgotyIFZPYTIInmC8rABumhzorB1EI";
    const vapidSubject = "mailto:heisenberg@zyntrahealthcareintelligence.com";

    const admin = createClient(supabaseUrl, serviceKey);

    const { user_ids, title, body, url, tag } = await req.json();

    if (!user_ids?.length || !title || !body) {
      return new Response(JSON.stringify({ error: "user_ids, title, body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch push subscriptions for these users
    const { data: subs, error: subErr } = await admin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", user_ids);

    if (subErr) throw subErr;
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, url: url || "/notifications", tag: tag || "zyntra" });

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    for (const sub of subs) {
      try {
        const encryptedPayload = await encryptPayload(sub.p256dh, sub.auth, payload);
        const vapidHeader = await createVapidAuthHeader(sub.endpoint, vapidPrivate, vapidPublic, vapidSubject);

        const resp = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            ...vapidHeader,
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
            Urgency: "normal",
          },
          body: encryptedPayload,
        });

        if (resp.status === 201 || resp.status === 200) {
          sent++;
        } else if (resp.status === 404 || resp.status === 410) {
          // Subscription expired – clean up
          staleEndpoints.push(sub.endpoint);
          failed++;
        } else {
          console.error(`Push failed ${resp.status}:`, await resp.text());
          failed++;
        }
      } catch (err) {
        console.error("Push send error:", err);
        failed++;
      }
    }

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    return new Response(JSON.stringify({ sent, failed, cleaned: staleEndpoints.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-push-notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
