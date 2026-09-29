import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  PAYPAL_PLANS,
  parseCustomId,
  paypalAccessToken,
  paypalFetch,
  planIdFor,
} from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  try {
    // Authenticate user (same as verify-razorpay-payment)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");
    const userId = userData.user.id;

    const { order_id, subscription_id } = await req.json();
    if (!order_id && !subscription_id) throw new Error("Missing order_id or subscription_id");

    // Idempotency: already recorded -> success without re-inserting
    const idColumn = subscription_id ? "paypal_subscription_id" : "paypal_order_id";
    const idValue = subscription_id || order_id;
    const { data: existing } = await supabase
      .from("payments")
      .select("id, tier, user_id")
      .eq(idColumn, idValue)
      .maybeSingle();
    if (existing) {
      if (existing.user_id !== userId) throw new Error("Payment belongs to another user");
      return json({ success: true, tier: existing.tier, already_processed: true });
    }

    const accessToken = await paypalAccessToken();

    let tier: string;
    let amount: number | null;
    let record: Record<string, unknown>;

    if (order_id) {
      // One-time (lifetime): capture the approved order
      let order = await paypalFetch(accessToken, `/v2/checkout/orders/${encodeURIComponent(order_id)}`);
      const unit = order.purchase_units?.[0];
      const parsed = parseCustomId(unit?.custom_id);
      if (!parsed || parsed.userId !== userId) throw new Error("Order does not belong to this user");
      const plan = PAYPAL_PLANS[parsed.tierKey];
      if (!plan || plan.kind !== "order") throw new Error("Invalid plan on order");
      if (unit?.amount?.currency_code !== "USD" || unit?.amount?.value !== plan.price) {
        throw new Error("Order amount mismatch");
      }

      if (order.status === "APPROVED") {
        order = await paypalFetch(accessToken, `/v2/checkout/orders/${encodeURIComponent(order_id)}/capture`, {
          method: "POST",
          headers: { "PayPal-Request-Id": `capture-${order_id}` },
        });
      }
      if (order.status !== "COMPLETED") throw new Error(`PayPal order not completed (status: ${order.status})`);

      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
      if (!capture || capture.status !== "COMPLETED") throw new Error("PayPal capture not completed");
      if (capture.amount?.currency_code !== "USD" || capture.amount?.value !== plan.price) {
        throw new Error("Captured amount mismatch");
      }

      tier = plan.tier;
      amount = Math.round(Number(plan.price));
      record = { paypal_order_id: order_id, paypal_capture_id: capture.id };
    } else {
      // Recurring: subscription must be ACTIVE (it can take a few seconds after approval)
      let sub = await paypalFetch(accessToken, `/v1/billing/subscriptions/${encodeURIComponent(subscription_id)}`);
      for (let i = 0; i < 5 && (sub.status === "APPROVAL_PENDING" || sub.status === "APPROVED"); i++) {
        await sleep(2000);
        sub = await paypalFetch(accessToken, `/v1/billing/subscriptions/${encodeURIComponent(subscription_id)}`);
      }
      const parsed = parseCustomId(sub.custom_id);
      if (!parsed || parsed.userId !== userId) throw new Error("Subscription does not belong to this user");
      const plan = PAYPAL_PLANS[parsed.tierKey];
      if (!plan || plan.kind !== "subscription") throw new Error("Invalid plan on subscription");
      if (sub.plan_id !== planIdFor(plan)) throw new Error("Subscription plan mismatch");
      if (sub.status !== "ACTIVE") throw new Error(`PayPal subscription not active (status: ${sub.status})`);

      tier = plan.tier;
      amount = Math.round(Number(plan.price));
      record = { paypal_subscription_id: subscription_id };
    }

    // Store payment record (mirrors verify-razorpay-payment: one active row in payments)
    const { error: insertError } = await supabase.from("payments").insert({
      user_id: userId,
      provider: "paypal",
      ...record,
      tier,
      status: "active",
      amount,
      currency: "USD",
    });

    if (insertError) {
      // Unique index hit by a concurrent request -> already processed
      if ((insertError as { code?: string }).code === "23505") return json({ success: true, tier, already_processed: true });
      throw insertError;
    }

    return json({ success: true, tier });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[VERIFY-PAYPAL] Error:", message);
    return json({ error: message }, 500);
  }
});
