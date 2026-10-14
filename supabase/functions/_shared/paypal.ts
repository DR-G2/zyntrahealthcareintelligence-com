// Shared PayPal helpers for create-paypal-order / verify-paypal-payment.
// Env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV (sandbox|live),
//      (plan env vars to be defined when the AUD Full Access PayPal plans exist)

export type PayPalPlan = {
  tier: "full_access"; // tier stored in payments (same as Razorpay flow)
  name: string;
  price: string; // AUD, server-side source of truth
  kind: "order" | "subscription";
  planEnv?: string; // env var holding the PayPal Billing Plan ID
};

// PayPal is HARD-DISABLED until rewritten for the single AUD Full Access plan
// (A$39/month, A$99/3 months, 7-day trial, A$1 card check). The old USD MCQ/Exam Master/Lifetime
// catalogue was removed. An empty catalogue makes create-paypal-order reject every request.
// TODO(owner): re-add full_access / full_access_3m in AUD with trial + card check before enabling.
export const PAYPAL_DISABLED = true;
export const PAYPAL_PLANS: Record<string, PayPalPlan> = {};

export function paypalBaseUrl(): string {
  return (Deno.env.get("PAYPAL_ENV") || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function planIdFor(plan: PayPalPlan): string {
  const id = plan.planEnv ? Deno.env.get(plan.planEnv) || "" : "";
  if (plan.kind === "subscription" && !id) throw new Error(`PayPal plan not configured (${plan.planEnv})`);
  return id;
}

export async function paypalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") || "";
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
  if (!clientId || !secret) throw new Error("PayPal is not configured");
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth error: ${await res.text()}`);
  const json = await res.json();
  return json.access_token as string;
}

// PayPal responses are loosely-typed JSON; callers read the fields they need.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function paypalFetch(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${paypalBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`PayPal API error (${res.status}): ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

// custom_id carried on the PayPal order/subscription: "<user_id>|<tierKey>"
export function makeCustomId(userId: string, tierKey: string): string {
  return `${userId}|${tierKey}`;
}

export function parseCustomId(customId: string | undefined | null): { userId: string; tierKey: string } | null {
  if (!customId) return null;
  const [userId, tierKey] = customId.split("|");
  if (!userId || !tierKey) return null;
  return { userId, tierKey };
}
