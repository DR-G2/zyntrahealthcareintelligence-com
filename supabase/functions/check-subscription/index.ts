import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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
    if (!authHeader?.startsWith("Bearer ")) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error(`Authentication error: ${claimsError?.message || "Invalid token"}`);
    
    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;
    if (!userEmail) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: userEmail });

    // 1. Check manual overrides first
    const { data: override } = await supabaseClient
      .from("manual_overrides")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (override) {
      const isExpired = override.expires_at && new Date(override.expires_at) < new Date();
      if (!isExpired) {
        logStep("Manual override found", { tier: override.tier });
        return new Response(JSON.stringify({
          subscribed: true,
          tier: override.tier,
          subscription_end: override.expires_at,
          manual_override: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // 2. Check local payments table for active payments
    const { data: payments, error: paymentsError } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (paymentsError) {
      logStep("Payments query error", { message: paymentsError.message });
    }

    if (payments && payments.length > 0) {
      const payment = payments[0];
      logStep("Active payment found", { tier: payment.tier, subscription_id: payment.razorpay_subscription_id });

      // For subscriptions, verify with Razorpay API that it's still active
      if (payment.razorpay_subscription_id) {
        const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
        const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
        const authString = btoa(`${keyId}:${keySecret}`);

        try {
          const subRes = await fetch(
            `https://api.razorpay.com/v1/subscriptions/${payment.razorpay_subscription_id}`,
            {
              headers: { "Authorization": `Basic ${authString}` },
            }
          );

          if (subRes.ok) {
            const sub = await subRes.json();
            if (sub.status === "active" || sub.status === "authenticated") {
              const endAt = sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null;
              return new Response(JSON.stringify({
                subscribed: true,
                tier: payment.tier,
                subscription_end: endAt,
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            } else {
              // Subscription expired/cancelled — mark payment inactive
              logStep("Subscription no longer active", { status: sub.status });
              await supabaseClient
                .from("payments")
                .update({ status: "cancelled" })
                .eq("id", payment.id);
            }
          }
        } catch (e) {
          logStep("Razorpay API check failed, using local data", { error: String(e) });
          // Fallback to local data
          return new Response(JSON.stringify({
            subscribed: true,
            tier: payment.tier,
            subscription_end: null,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      } else {
        // One-time payment (lifetime) — always active
        return new Response(JSON.stringify({
          subscribed: true,
          tier: payment.tier,
          subscription_end: null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    logStep("No active subscription or payment found");
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
