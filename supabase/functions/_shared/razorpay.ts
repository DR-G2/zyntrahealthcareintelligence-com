// Minimal Razorpay helpers shared by edge functions.
import { cancelAlreadyDone } from "./billing-lifecycle.ts";

export function razorpayAuth(): string {
  return `Basic ${btoa(`${Deno.env.get("RAZORPAY_KEY_ID") ?? ""}:${Deno.env.get("RAZORPAY_KEY_SECRET") ?? ""}`)}`;
}

/** Cancel a subscription IMMEDIATELY (no further charges). Never throws.
 * Returns true when Razorpay accepted the cancel OR (Gus R5) the cancel was refused because the subscription is
 * already terminal (cancelled / completed / expired, e.g. cancelled in the dashboard): nothing left to stop. */
export async function cancelSubscriptionNow(subscriptionId: string, reason: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: "POST",
      headers: { Authorization: razorpayAuth(), "Content-Type": "application/json" },
      body: JSON.stringify({ cancel_at_cycle_end: 0 }),
    });
    console.log(`[RAZORPAY] cancel-now ${subscriptionId} (${reason}) -> ${r.status}`);
    if (r.ok) return true;
    const sub = await fetchSubscription(subscriptionId);
    if (cancelAlreadyDone(sub?.status)) {
      console.log(`[RAZORPAY] cancel-now ${subscriptionId}: already ${sub!.status}; treating as done`);
      return true;
    }
    return false;
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
