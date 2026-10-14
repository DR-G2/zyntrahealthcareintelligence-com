import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyHmacSignature } from "../_shared/signature.ts";
import { pickSubscriptionRow, provisionalPeriodEnd, reconcilesPendingRow, verifyDecision } from "../_shared/billing-lifecycle.ts";
import { cancelSubscriptionNow } from "../_shared/razorpay.ts";

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
        : rz?.start_at && rz?.notes?.trial === "yes" ? new Date(rz.start_at * 1000).toISOString()
        // No-trial resubscribe before current_end exists: provisional now + interval (never undated/unlimited).
        : provisionalPeriodEnd(rz?.notes?.interval === "quarterly" ? "quarterly" : "monthly"),
    };

    let insertError: unknown = null;
    if (razorpay_subscription_id) {
      // RACE GUARD: only accept a subscription that matches this user's own pending row
      // (reserved by create-razorpay-order before Razorpay was called).
      // Retest 4 nit: a sub id may have a real row plus an audit orphan -> list + prefer non-orphan (no maybeSingle error).
      const { data: subRows } = await supabase.from("payments")
        .select("id,user_id,status,razorpay_subscription_id,razorpay_payment_id")
        .eq("razorpay_subscription_id", razorpay_subscription_id).order("created_at", { ascending: true }).limit(10);
      let pend = pickSubscriptionRow(subRows);
      if (!pend && rz?.notes?.pending_payment_id) {
        // N1 crash-safety: create died before saving sub.id -> reconcile via notes.pending_payment_id.
        const { data: cand } = await supabase.from("payments")
          .select("id,user_id,status,razorpay_subscription_id,razorpay_payment_id").eq("id", rz.notes.pending_payment_id).maybeSingle();
        if (reconcilesPendingRow(userId, rz.notes, cand)) {
          await supabase.from("payments").update({ razorpay_subscription_id }).eq("id", cand!.id).is("razorpay_subscription_id", null);
          pend = { ...cand!, razorpay_subscription_id };
        }
      }
      const decision = verifyDecision(userId, razorpay_subscription_id, pend);
      if (decision === "idempotent") {
        // Webhook-first race: the webhook already promoted this user's row. Success, never cancel.
        if (!pend!.razorpay_payment_id) {
          await supabase.from("payments").update({ razorpay_payment_id }).eq("id", pend!.id).is("razorpay_payment_id", null);
        }
        return new Response(JSON.stringify({ success: true, tier, already_active: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (decision === "reject") {
        // Hank B1: authorised at Razorpay but no valid reservation -> stop it charging NOW and flag the
        // authorisation payment (e.g. A$1 card check) for manual refund. No access is granted.
        const cancelled = await cancelSubscriptionNow(razorpay_subscription_id, `verify:${pend ? pend.status : "no"}-row`);
        if (!cancelled) console.error("[VERIFY-RAZORPAY] ALERT NEEDS_CANCEL: Razorpay cancel failed; queued for hourly retry", { razorpay_subscription_id });
        const flags = { needs_refund: true, refund_payment_id: razorpay_payment_id, needs_cancel: !cancelled };
        if (pend && pend.user_id === userId) {
          await supabase.from("payments").update(flags).eq("id", pend.id); // replays reuse this row (incl. orphan)
        } else if (!pend) {
          await supabase.from("payments").insert({ user_id: userId, razorpay_subscription_id, tier, status: "orphan", ...flags });
        } else if (!cancelled) {
          await supabase.from("payments").update({ needs_cancel: true }).eq("id", pend.id);
        }
        throw new ClientError("This checkout is no longer valid and has been cancelled. Any charge will be refunded.", 409);
      }
      const { data: updated, error } = await supabase.from("payments").update({
        razorpay_payment_id, status: "active", ...dates,
      }).eq("id", pend!.id).eq("status", "pending").select("id");
      insertError = error;
      // Follow-up: a concurrent verify/webhook may have promoted the row already; 0 rows is not success.
      if (!error && !updated?.length) {
        const { data: now } = await supabase.from("payments").select("status").eq("id", pend!.id).maybeSingle();
        if (now?.status !== "active") throw new ClientError("Could not activate this checkout. Please contact support.", 409);
      }
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
