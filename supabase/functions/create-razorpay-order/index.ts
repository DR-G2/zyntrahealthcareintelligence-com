import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Server-side price and plan catalogue — never trust amounts or tiers from the browser.
const LIFETIME_PRICE_USD = 349;
const PLAN_TIER_MAP: Record<string, string> = {
  plan_SOsMQofBcfw3BU: "mcq_only",
  plan_SOsNlReb9DLlAw: "mcq_only",
  plan_SOsQDhBQkgyFfr: "full_access",
  plan_SOsR9Hjy6UHpNG: "full_access",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { planId, mode } = await req.json();

    const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
    const authString = btoa(`${keyId}:${keySecret}`);

    if (mode === "payment") {
      // One-time payment (lifetime) — create Razorpay Order
      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
        },
        body: JSON.stringify({
          amount: LIFETIME_PRICE_USD * 100, // fixed server-side price in cents
          currency: "USD",
          notes: {
            user_id: user.id,
            email: user.email,
            tier: "lifetime",
          },
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.text();
        throw new Error(`Razorpay order error: ${err}`);
      }

      const order = await orderRes.json();

      return new Response(JSON.stringify({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: keyId,
        tier: "lifetime",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Subscription — create Razorpay Subscription
      const tier = PLAN_TIER_MAP[planId];
      if (!planId || !tier) throw new Error("Unknown plan");

      const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
        },
        body: JSON.stringify({
          plan_id: planId,
          total_count: mode === "subscription" ? 12 : 1,
          notes: {
            user_id: user.id,
            email: user.email,
            tier,
          },
        }),
      });

      if (!subRes.ok) {
        const err = await subRes.text();
        throw new Error(`Razorpay subscription error: ${err}`);
      }

      const sub = await subRes.json();

      return new Response(JSON.stringify({
        subscription_id: sub.id,
        key_id: keyId,
        tier,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
