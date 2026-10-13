import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { verifyHmacSignature } from "../_shared/signature.ts";
import { matchesPendingRow } from "../_shared/billing-lifecycle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


class ClientError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new ClientError("No authorization header", 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new ClientError("Authentication failed", 401);
    const userId = userData.user.id;

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_subscription_id,
      razorpay_signature,
    } = await req.json();

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";

    // Verify signature
    let signatureBody: string;
    if (razorpay_order_id) {
      // One-time payment
      signatureBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    } else if (razorpay_subscription_id) {
      // Subscription
      signatureBody = `${razorpay_payment_id}|${razorpay_subscription_id}`;
    } else {
      throw new ClientError("Missing order_id or subscription_id", 400);
    }

    const isValid = await verifyHmacSignature(signatureBody, razorpay_signature, keySecret);
    if (!isValid) {
      throw new ClientError("Invalid payment signature", 400);
    }

    // Derive tier and amount from Razorpay's own record (notes were set server-side at checkout)
    const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
    const rzAuth = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
    const rzPath = razorpay_order_id
      ? `orders/${encodeURIComponent(razorpay_order_id)}`
      : `subscriptions/${encodeURIComponent(razorpay_subscription_id)}`;
    const rzRes = await fetch(`https://api.razorpay.com/v1/${rzPath}`, { headers: { Authorization: rzAuth } });
    if (!rzRes.ok) throw new Error("Could not confirm payment with provider");
    const rz = await rzRes.json();
    if (rz?.notes?.user_id !== userId) throw new ClientError("Payment does not belong to this account", 403);
    const allowedTiers = ["full_access"];
    const tier = rz?.notes?.tier;
    if (!allowedTiers.includes(tier)) throw new ClientError("Unknown plan on payment", 400);
    const amount = razorpay_order_id && typeof rz.amount_paid === "number" ? Math.round(rz.amount_paid / 100) : null;

    // Replay protection: a payment id is recorded at most once (UNIQUE index in migration 20261014050000).
    const { data: already } = await supabase.from("payments").select("id,user_id").eq("razorpay_payment_id", razorpay_payment_id).maybeSingle();
    if (already) {
      if (already.user_id !== userId) throw new ClientError("Payment does not belong to this account", 409);
      return new Response(JSON.stringify({ success: true, tier, already_recorded: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dates = {
      // start_at = trial end / first charge (absent for no-trial resubscribes).
      trial_end_at: rz?.start_at && rz?.notes?.trial === "yes" ? new Date(rz.start_at * 1000).toISOString() : null,
      // Paid-through: Razorpay current_end once billed; during trial, access runs to trial end.
      current_period_end: rz?.current_end ? new Date(rz.current_end * 1000).toISOString()
        : rz?.start_at ? new Date(rz.start_at * 1000).toISOString() : null,
    };

    let insertError: unknown = null;
    if (razorpay_subscription_id) {
      // RACE GUARD: only accept a subscription that matches this user's own pending row
      // (reserved by create-razorpay-order before Razorpay was called).
      const { data: pend } = await supabase.from("payments")
        .select("id,user_id,status,razorpay_subscription_id")
        .eq("razorpay_subscription_id", razorpay_subscription_id).maybeSingle();
      if (!matchesPendingRow(userId, razorpay_subscription_id, pend)) {
        throw new ClientError("This checkout is no longer valid. Please start again.", 409);
      }
      const { error } = await supabase.from("payments").update({
        razorpay_payment_id, status: "active", ...dates,
      }).eq("id", pend!.id).eq("status", "pending");
      insertError = error;
    } else {
      // Legacy one-time order path (follow-up: remove). Upsert ignoreDuplicates covers concurrent verifies.
      const { error } = await supabase.from("payments").upsert({
        user_id: userId, razorpay_payment_id, razorpay_order_id: razorpay_order_id || null,
        tier, status: "active", amount,
      }, { onConflict: "razorpay_payment_id", ignoreDuplicates: true });
      insertError = error;
    }

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, tier }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // Full detail to logs only; client gets a generic message (no provider internals).
    console.error("[VERIFY-RAZORPAY] Error:", error?.message);
    const status = error instanceof ClientError ? error.status : 500;
    const msg = error instanceof ClientError ? error.message : "Payment verification failed. If you were charged, contact support.";
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
