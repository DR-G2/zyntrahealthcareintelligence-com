import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Product ID → tier mapping
const PRODUCT_TIER_MAP: Record<string, string> = {
  'prod_U6zJQt8jlti5si': 'mcq_only',
  'prod_U6zKnCYIVwHDwb': 'mcq_only',
  'prod_U6zKZcaEJfbQQ5': 'osce_only',
  'prod_U6zKcaN9wFpuNg': 'osce_only',
  'prod_U6zKrKxtp16K7W': 'full_access',
  'prod_U6zKGMBtlFy4Oz': 'full_access',
  'prod_U6zK1OPYlEhP7U': 'lifetime',
  // Legacy
  'prod_U6yxXHRvDd4Ez8': 'full_access',
  'prod_U6yy9VWpyT13u1': 'full_access',
  'prod_U6sMkFKlyQoIuh': 'lifetime',
  'prod_U6sKBIdCnUC1WH': 'full_access',
  'prod_U6sKziBbluGb0Q': 'full_access',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    // 1. Check manual overrides first
    const { data: override } = await supabaseClient
      .from("manual_overrides")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (override) {
      const isExpired = override.expires_at && new Date(override.expires_at) < new Date();
      if (!isExpired) {
        logStep("Manual override found", { tier: override.tier });
        return new Response(JSON.stringify({
          subscribed: true,
          tier: override.tier,
          product_id: null,
          subscription_end: override.expires_at,
          manual_override: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // 2. Check Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false, tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    // Check active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      const productId = sub.items.data[0].price.product as string;
      const subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
      const tier = PRODUCT_TIER_MAP[productId] || "full_access";
      logStep("Active subscription", { tier, productId });

      return new Response(JSON.stringify({
        subscribed: true,
        tier,
        product_id: productId,
        subscription_end: subscriptionEnd,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for lifetime (one-time payment)
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 100,
    });

    const lifetimeSession = sessions.data.find(s =>
      s.payment_status === "paid" && s.mode === "payment"
    );

    if (lifetimeSession) {
      logStep("Lifetime purchase found");
      return new Response(JSON.stringify({
        subscribed: true,
        tier: "lifetime",
        product_id: "prod_U6zK1OPYlEhP7U",
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("No active subscription or lifetime purchase");
    return new Response(JSON.stringify({ subscribed: false, tier: "free" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
