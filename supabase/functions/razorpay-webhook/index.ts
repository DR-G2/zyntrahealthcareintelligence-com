import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[RAZORPAY-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-Razorpay-Signature") || "";
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || "";

    if (!webhookSecret) {
      log("ERROR", "RAZORPAY_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      log("ERROR", "Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event as string;
    const entity = payload.payload?.subscription?.entity || payload.payload?.payment?.entity;

    if (!entity) {
      log("WARN", { event, message: "No entity in payload" });
      return new Response(JSON.stringify({ status: "ok", message: "No entity" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const notes = entity.notes || {};
    const userId = notes.user_id;
    const tier = notes.tier || "full_access";

    log("Event received", { event, userId, tier });

    if (!userId) {
      log("WARN", "No user_id in notes, skipping");
      return new Response(JSON.stringify({ status: "ok", message: "No user_id in notes" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle subscription events
    if (event.startsWith("subscription.")) {
      const subscriptionId = entity.id;
      const paymentId = payload.payload?.payment?.entity?.id || null;

      let status: string;
      switch (event) {
        case "subscription.activated":
        case "subscription.charged":
          status = "active";
          break;
        case "subscription.completed":
        case "subscription.cancelled":
        case "subscription.expired":
          status = "cancelled";
          break;
        case "subscription.halted":
        case "subscription.pending":
          status = "paused";
          break;
        default:
          log("Unhandled subscription event", { event });
          return new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
      }

      // Upsert: update existing record by subscription_id or insert new
      const { data: existing } = await supabase
        .from("payments")
        .select("id")
        .eq("user_id", userId)
        .eq("razorpay_subscription_id", subscriptionId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("payments")
          .update({ status, razorpay_payment_id: paymentId || undefined })
          .eq("id", existing.id);
        if (error) throw error;
        log("Updated payment", { id: existing.id, status });
      } else {
        const { error } = await supabase.from("payments").insert({
          user_id: userId,
          razorpay_subscription_id: subscriptionId,
          razorpay_payment_id: paymentId,
          tier,
          status,
        });
        if (error) throw error;
        log("Inserted payment", { subscriptionId, status });
      }
    }

    // Handle one-time payment events
    if (event === "payment.captured") {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const amount = payment.amount ? Math.round(payment.amount / 100) : null;

      // Only process order-based (non-subscription) payments
      if (orderId && !payment.subscription_id) {
        const { data: existing } = await supabase
          .from("payments")
          .select("id")
          .eq("user_id", userId)
          .eq("razorpay_order_id", orderId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("payments")
            .update({ status: "active", razorpay_payment_id: paymentId })
            .eq("id", existing.id);
          log("Updated one-time payment", { id: existing.id });
        } else {
          await supabase.from("payments").insert({
            user_id: userId,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            tier,
            status: "active",
            amount,
          });
          log("Inserted one-time payment", { orderId });
        }
      }
    }

    if (event === "payment.failed") {
      const payment = payload.payload.payment.entity;
      log("Payment failed", { paymentId: payment.id, userId });
      // We don't cancel existing active subscriptions on a single failed payment;
      // Razorpay will send subscription.halted if retries are exhausted.
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    // Return 200 to prevent Razorpay from retrying on our errors
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
