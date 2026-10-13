// Minimal Razorpay helpers shared by edge functions.

export function razorpayAuth(): string {
  return `Basic ${btoa(`${Deno.env.get("RAZORPAY_KEY_ID") ?? ""}:${Deno.env.get("RAZORPAY_KEY_SECRET") ?? ""}`)}`;
}

/** Cancel a subscription IMMEDIATELY (no further charges). Never throws; returns whether Razorpay accepted it. */
export async function cancelSubscriptionNow(subscriptionId: string, reason: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: "POST",
      headers: { Authorization: razorpayAuth(), "Content-Type": "application/json" },
      body: JSON.stringify({ cancel_at_cycle_end: 0 }),
    });
    console.log(`[RAZORPAY] cancel-now ${subscriptionId} (${reason}) -> ${r.status}`);
    return r.ok;
  } catch (e) {
    console.error(`[RAZORPAY] cancel-now ${subscriptionId} failed`, e instanceof Error ? e.message : e);
    return false;
  }
}

export async function fetchSubscription(subscriptionId: string): Promise<{ id: string; status: string; [k: string]: unknown } | null> {
  try {
    const r = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, { headers: { Authorization: razorpayAuth() } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
