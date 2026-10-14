import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkoutDecision, entitlementFromRow, pickEntitledRow, razorpaySyncUpdate, syncOwnershipOk } from "../_shared/billing-lifecycle.ts";
import { fetchSubscription } from "../_shared/razorpay.ts";

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

    // 1b. V2 port (Hank): upsert from Razorpay. If the user's newest Razorpay row is not yet 'active'
    // (pending/authenticated: webhook missed or not yet delivered on V2), pull the subscription and
    // write status + dates back. Never grants by itself: entitlement still comes from stored dates below.
    try {
      const { data: openRows } = await supabaseClient.from("payments")
        .select("id,user_id,status,razorpay_subscription_id,trial_end_at,current_period_end")
        .eq("user_id", userId).in("status", ["pending", "authenticated"])
        .not("razorpay_subscription_id", "is", null)
        .order("created_at", { ascending: false }).limit(1);
      const open = openRows?.[0];
      if (open) {
        const sub = await fetchSubscription(open.razorpay_subscription_id);
        // Hank B3: same ownership rule as authorizeCancel: provider sub id must match the row AND notes.user_id == caller.
        const upd = sub && syncOwnershipOk(userId, open, sub) ? razorpaySyncUpdate(sub) : null;
        if (sub && !upd) logStep("Razorpay sync refused or nothing to write", { id: open.id });
        if (upd) {
          await supabaseClient.from("payments").update(upd).eq("id", open.id).eq("user_id", userId).in("status", ["pending", "authenticated"]);
          logStep("Synced payment row from Razorpay", { id: open.id, status: upd.status });
        }
      }
    } catch (e) {
      logStep("Razorpay sync skipped", { error: String(e) });
    }

    // 2. Check local payments table for active payments
    const { data: payments, error: paymentsError } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (paymentsError) {
      logStep("Payments query error", { message: paymentsError.message });
    }

    if (payments && payments.length > 0) {
      // Same selection rule as hasPaidAccess: any entitled row wins (else newest, for refresh).
      const payment = pickEntitledRow(payments).row!;
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
            .eq("id", payment.id)
            .eq("user_id", userId);
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
              await supabaseClient.from("payments").update({ status: "cancelled" }).eq("id", payment.id).eq("user_id", userId);
              row = { ...payment, status: "cancelled" };
            } else if (typeof (sub.current_end ?? sub.charge_at) === "number") {
              // current_end once billed; during trial charge_at (= trial end) backfills null-date rows.
              const fresh = new Date((sub.current_end ?? sub.charge_at) * 1000).toISOString();
              if (!payment.current_period_end || fresh > payment.current_period_end) {
                await supabaseClient.from("payments").update({ current_period_end: fresh }).eq("id", payment.id).eq("user_id", userId);
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
          ? { subscribed: true, tier: payment.tier, plan_amount: payment.amount ?? null, plan_interval: payment.plan_interval ?? null, subscription_end: ent.endsAt, cancel_at_period_end: !!row.cancel_at_period_end, in_trial: ent.reason === "trial" }
          : { subscribed: false, tier: "free", subscription_end: ent.endsAt }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        // One-time / no-subscription rows: fail closed unless the explicit legacy 'lifetime' tier.
        const ent = entitlementFromRow(payment);
        return new Response(JSON.stringify(ent.entitled
          ? { subscribed: true, tier: payment.tier, subscription_end: ent.endsAt }
          : { subscribed: false, tier: "free" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    logStep("No active subscription or payment found");
    // trial_eligible: never trialled/subscribed before (returning customers resubscribe without a trial).
    const { data: hist } = await supabaseClient.from("payments")
      .select("status,trial_end_at,razorpay_subscription_id").eq("user_id", userId);
    const decision = checkoutDecision(hist ?? []);
    const trialEligible = decision.ok && decision.trial;
    return new Response(JSON.stringify({ subscribed: false, tier: "free", trial_eligible: trialEligible }), {
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
