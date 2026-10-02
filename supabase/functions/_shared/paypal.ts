// Shared PayPal helpers for create-paypal-order / verify-paypal-payment.
// Env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV (sandbox|live),
//      PAYPAL_PLAN_MCQ_1M, PAYPAL_PLAN_MCQ_3M, PAYPAL_PLAN_PASS_1M, PAYPAL_PLAN_PASS_3M

export type PayPalPlan = {
  tier: "mcq_only" | "full_access" | "lifetime"; // tier stored in payments (same as Razorpay flow)
  name: string;
  price: string; // USD, server-side source of truth
  kind: "order" | "subscription";
  planEnv?: string; // env var holding the PayPal Billing Plan ID
};

// Keys match the frontend RAZORPAY_TIERS keys. Prices match the site (USD).
export const PAYPAL_PLANS: Record<string, PayPalPlan> = {
  mcq_only: { tier: "mcq_only", name: "Clinical Starter", price: "39.00", kind: "subscription", planEnv: "PAYPAL_PLAN_MCQ_1M" },
  mcq_only_3m: { tier: "mcq_only", name: "Clinical Starter (3 months)", price: "109.00", kind: "subscription", planEnv: "PAYPAL_PLAN_MCQ_3M" },
  full_access: { tier: "full_access", name: "Exam Master", price: "59.00", kind: "subscription", planEnv: "PAYPAL_PLAN_PASS_1M" },
  full_access_3m: { tier: "full_access", name: "Exam Master (3 months)", price: "169.00", kind: "subscription", planEnv: "PAYPAL_PLAN_PASS_3M" },
  lifetime: { tier: "lifetime", name: "Lifetime", price: "349.00", kind: "order" },
};

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
