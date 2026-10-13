import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { firstChargeUnix, PLAN_PRICES, type PlanInterval } from "../_shared/billing-dates.ts";

// Server-side plan catalogue — never trust plan IDs, amounts or tiers from the browser.
// Single plan: Full Access, AUD. The client sends only { interval: "monthly" | "quarterly" }.
// Live AUD plan IDs come from env (set by owner):
//   RAZORPAY_PLAN_FULL_MONTHLY_AUD (A$39/month), RAZORPAY_PLAN_FULL_3M_AUD (A$99/3 months).
const PLAN_ENV: Record<PlanInterval, string> = {
  monthly: "RAZORPAY_PLAN_FULL_MONTHLY_AUD",
  quarterly: "RAZORPAY_PLAN_FULL_3M_AUD",
};
const CARD_CHECK_CENTS = 100; // A$1 card check, upfront add-on
// "Until you cancel": Razorpay requires a finite total_count, so use a long horizon (~10 years) rather
// than 12/4 charges, which would end paid access after one year via subscription.completed.
// TODO(owner): confirm Razorpay's max total_count for AUD plans in test mode.
const TOTAL_COUNT: Record<PlanInterval, number> = { monthly: 120, quarterly: 40 };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) return reply({ error: "User not authenticated" }, 401);

    const { interval } = await req.json();
    if (interval !== "monthly" && interval !== "quarterly") return reply({ error: "Unknown plan interval" }, 400);
    const planId = Deno.env.get(PLAN_ENV[interval as PlanInterval]);
    if (!planId) return reply({ error: "Checkout is not available yet" }, 503);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
    const authString = btoa(`${keyId}:${keySecret}`);

    // First charge = trial-end Sydney calendar date at a fixed Sydney local time — the same
    // shared helper the checkout copy uses, so the date shown always equals the date charged.
    const startAt = firstChargeUnix(new Date());

    const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Basic ${authString}` },
      body: JSON.stringify({
        plan_id: planId,
        total_count: TOTAL_COUNT[interval as PlanInterval],
        start_at: startAt,
        addons: [{ item: { name: "Card check (non-refundable)", amount: CARD_CHECK_CENTS, currency: "AUD" } }],
        notes: {
          user_id: user.id,
          email: user.email,
          tier: "full_access",
          interval,
          price_aud: PLAN_PRICES[interval as PlanInterval].price,
        },
      }),
    });
    if (!subRes.ok) throw new Error(`Razorpay subscription error: ${await subRes.text()}`);
    const sub = await subRes.json();

    return reply({ subscription_id: sub.id, key_id: keyId, tier: "full_access", trial_end_at: new Date(startAt * 1000).toISOString() });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Checkout failed" }, 500);
  }
});
