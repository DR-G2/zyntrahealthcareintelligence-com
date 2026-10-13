import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { entitlementFromRow } from "../_shared/billing-lifecycle.ts";

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

      // PayPal subscriptions: verify with PayPal API that it's still active
      if (payment.paypal_subscription_id) {
        try {
          const paypalBase = (Deno.env.get("PAYPAL_ENV") || "sandbox").toLowerCase() === "live"
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";
          const ppAuth = btoa(`${Deno.env.get("PAYPAL_CLIENT_ID") || ""}:${Deno.env.get("PAYPAL_CLIENT_SECRET") || ""}`);
          const tokenRes = await fetch(`${paypalBase}/v1/oauth2/token`, {
            method: "POST",
            headers: { "Authorization": `Basic ${ppAuth}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: "grant_type=client_credentials",
          });
          if (!tokenRes.ok) throw new Error(`PayPal auth failed (${tokenRes.status})`);
          const { access_token } = await tokenRes.json();
          const subRes = await fetch(`${paypalBase}/v1/billing/subscriptions/${payment.paypal_subscription_id}`, {
            headers: { "Authorization": `Bearer ${access_token}` },
          });
          if (!subRes.ok) throw new Error(`PayPal subscription lookup failed (${subRes.status})`);
          const sub = await subRes.json();
          if (sub.status === "ACTIVE") {
            return new Response(JSON.stringify({
              subscribed: true,
              tier: payment.tier,
              subscription_end: sub.billing_info?.next_billing_time ?? null,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
          // Subscription cancelled/suspended/expired — mark payment inactive
          logStep("PayPal subscription no longer active", { status: sub.status });
          await supabaseClient
            .from("payments")
            .update({ status: "cancelled" })
            .eq("id", payment.id);
        } catch (e) {
          logStep("PayPal API check failed; failing closed", { error: String(e) });
          // Fail closed: a provider outage must not grant access (PayPal checkout is disabled anyway).
          return new Response(JSON.stringify({
            subscribed: false,
            tier: "free",
            verification_unavailable: true,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      // For subscriptions, verify with Razorpay API that it's still active
      } else if (payment.razorpay_subscription_id) {
        // Entitlement comes from STORED dates (trial_end_at / current_period_end / cancel_at_period_end).
        // Razorpay is consulted only to refresh those dates; an API failure never extends access.
        let row = payment;
        const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
        const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
        try {
          const subRes = await fetch(
            `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(payment.razorpay_subscription_id)}`,
            { headers: { "Authorization": `Basic ${btoa(`${keyId}:${keySecret}`)}` } },
          );
          if (subRes.ok) {
            const sub = await subRes.json();
            if (["cancelled", "completed", "expired"].includes(sub.status) && !payment.cancel_at_period_end) {
              logStep("Subscription ended at provider", { status: sub.status });
              await supabaseClient.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
              row = { ...payment, status: "cancelled" };
            } else if (typeof sub.current_end === "number") {
              const fresh = new Date(sub.current_end * 1000).toISOString();
              if (!payment.current_period_end || fresh > payment.current_period_end) {
                await supabaseClient.from("payments").update({ current_period_end: fresh }).eq("id", payment.id);
                row = { ...payment, current_period_end: fresh };
              }
            }
          }
        } catch (e) {
          logStep("Razorpay refresh failed; using stored dates only", { error: String(e) });
        }
        const ent = entitlementFromRow(row);
        logStep("Entitlement", ent);
        return new Response(JSON.stringify(ent.entitled
          ? { subscribed: true, tier: payment.tier, plan_amount: payment.amount ?? null, subscription_end: ent.endsAt, cancel_at_period_end: !!row.cancel_at_period_end, in_trial: ent.reason === "trial" }
          : { subscribed: false, tier: "free", subscription_end: ent.endsAt }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
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
    return new Response(JSON.stringify({ error: "Could not check subscription" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
