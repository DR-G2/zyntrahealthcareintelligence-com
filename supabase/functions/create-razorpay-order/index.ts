import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// Server-side price and plan catalogue — never trust amounts or tiers from the browser.
// Single plan: Full Access, AUD. Live AUD plan IDs come from env (set by owner):
//   RAZORPAY_PLAN_FULL_MONTHLY_AUD (A$39/month), RAZORPAY_PLAN_FULL_3M_AUD (A$99/3 months).
// 7-day trial: subscription start_at = now + 7 days. A$1 card check: upfront addon (non-refundable).
// Anniversary billing: Razorpay renews on the same day as start_at (trial end), which matches the confirmed model.
const TRIAL_DAYS = 7;
const CARD_CHECK_CENTS = 100; // A$1
const PLAN_CATALOG: Record<string, { tier: string; intervalMonths: number }> = Object.fromEntries(
  [
    [Deno.env.get("RAZORPAY_PLAN_FULL_MONTHLY_AUD"), 1],
    [Deno.env.get("RAZORPAY_PLAN_FULL_3M_AUD"), 3],
  ].filter(([id]) => !!id).map(([id, m]) => [id as string, { tier: "full_access", intervalMonths: m as number }]),
);

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

    if (mode === "payment") throw new Error("One-time plans are no longer offered");
    {
      // Subscription — create Razorpay Subscription
      const catalog = planId ? PLAN_CATALOG[planId] : undefined;
      if (!planId || !catalog) throw new Error("Unknown plan");
      const { tier, intervalMonths } = catalog;

      const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
        },
        body: JSON.stringify({
          plan_id: planId,
          total_count: intervalMonths === 1 ? 12 : 4,
          start_at: Math.floor(Date.now() / 1000) + TRIAL_DAYS * 86400,
          addons: [{ item: { name: "Card check (non-refundable)", amount: CARD_CHECK_CENTS, currency: "AUD" } }],
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
