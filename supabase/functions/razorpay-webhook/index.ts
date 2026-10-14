import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { verifyHmacSignature } from "../_shared/signature.ts";
import { isExpectedUniqueViolation, RAZORPAY_PAYMENT_ID_KEY, REFUND_PAYMENT_ID_KEY, orphanAction, pickSubscriptionRow, reconcilesPendingRow } from "../_shared/billing-lifecycle.ts";
import { cancelSubscriptionNow } from "../_shared/razorpay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[RAZORPAY-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};


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

    const isValid = await verifyHmacSignature(rawBody, signature, webhookSecret);
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
        // authenticated = mandate approved, trial running (promotes the reserved pending row if verify never ran)
        case "subscription.authenticated":
        case "subscription.activated":
        case "subscription.charged":
          status = "active";
          break;
        // completed = all total_count cycles billed (~10y horizon, see create-razorpay-order); the
        // last paid period has already ended at that point, so ending entitlement is correct.
        // cancelled fires at cycle end for user cancels (cancel_at_cycle_end=1) or immediately in trial.
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

      // Only rows reserved by create-razorpay-order (pending -> active) are ever updated; unknown
      // subscriptions are rejected (logged), never inserted.
      // Retest 4 nit: several rows can share a sub id (real + audit orphan); never maybeSingle (it errors on >1).
      const { data: foundRows } = await supabase
        .from("payments")
        .select("id,status,razorpay_payment_id")
        .eq("user_id", userId)
        .eq("razorpay_subscription_id", subscriptionId)
        .order("created_at", { ascending: true })
        .limit(10);
      let existing = pickSubscriptionRow(foundRows);
      if (!existing && notes.pending_payment_id) {
        // N1 crash-safety: reconcile a pending row whose subscription id was never saved.
        const { data: cand } = await supabase.from("payments")
          .select("id,user_id,status,razorpay_subscription_id,razorpay_payment_id").eq("id", notes.pending_payment_id).maybeSingle();
        if (reconcilesPendingRow(userId, notes, cand)) {
          await supabase.from("payments").update({ razorpay_subscription_id: subscriptionId }).eq("id", cand!.id).is("razorpay_subscription_id", null);
          existing = { id: cand!.id, status: cand!.status, razorpay_payment_id: cand!.razorpay_payment_id };
        }
      }

      const action = orphanAction(existing, status === "active", !!paymentId);
      if (action !== "none") {
        // Hank B1: unknown / expired / cancelled row but Razorpay is live -> stop it charging NOW,
        // and flag any captured money for manual refund. Never grant access.
        const cancelled = await cancelSubscriptionNow(subscriptionId, existing ? `webhook:${existing.status}-row` : "webhook:no-row");
        // Retest 4 #1: a failed cancel is flagged and retried hourly by retry-razorpay-cancels.
        const flags: Record<string, unknown> = { needs_cancel: !cancelled };
        if (action === "cancel_and_refund") { flags.needs_refund = true; flags.refund_payment_id = paymentId; }
        if (!cancelled) log("ALERT NEEDS_CANCEL: Razorpay cancel failed; queued for hourly retry", { event, subscriptionId, userId });
        if (existing) {
          // Replays land on the same row (incl. an existing orphan row) -> no stacking.
          const { error } = await supabase.from("payments").update(flags).eq("id", existing.id);
          if (error && !isExpectedUniqueViolation(error, [REFUND_PAYMENT_ID_KEY])) throw error;
          // Gus R6 N1: the duplicate refund_payment_id skipped the WHOLE update, so persist needs_cancel separately.
          if (error && !cancelled) {
            const { error: ncErr } = await supabase.from("payments").update({ needs_cancel: true }).eq("id", existing.id);
            if (ncErr) throw ncErr;
          }
        } else {
          // Audit row (status 'orphan' is not an open/entitling status). Only reached when no row
          // with this sub id exists, so replays update the row above instead of inserting again.
          const { error } = await supabase.from("payments").insert({
            user_id: userId, razorpay_subscription_id: subscriptionId, tier, status: "orphan", ...flags,
          });
          // Gus R5: a concurrent/redelivered event already recorded this payment id -> no-op success (200),
          // so Razorpay stops redelivering.
          if (error && !isExpectedUniqueViolation(error, [REFUND_PAYMENT_ID_KEY, RAZORPAY_PAYMENT_ID_KEY])) throw error;
          // Gus R6 N1: the audit row already exists (same payment id) -> flag it for the hourly cancel retry.
          if (error && !cancelled) {
            const bySub = await supabase.from("payments").update({ needs_cancel: true }).eq("razorpay_subscription_id", subscriptionId);
            if (bySub.error) throw bySub.error;
            if (paymentId) {
              const byPay = await supabase.from("payments").update({ needs_cancel: true }).eq("refund_payment_id", paymentId);
              if (byPay.error) throw byPay.error;
            }
          }
          if (error) log("Duplicate payment id already recorded; no-op", { event, subscriptionId, paymentId });
        }
        log(action === "cancel_and_refund" ? "NEEDS_REFUND: charge on unknown/ended subscription; cancelled at provider" : "Cancelled unknown/ended subscription at provider", { event, subscriptionId, userId, row: existing?.id ?? null });
      } else if (!existing) {
        log("Ignored non-granting event for unknown subscription", { event, subscriptionId });
      } else {
        const { error } = await supabase
          .from("payments")
          .update({
            status,
            // Keep the first payment id (replay key); renewals go to last_razorpay_payment_id.
            ...(paymentId && !existing.razorpay_payment_id ? { razorpay_payment_id: paymentId } : {}),
            ...(paymentId ? { last_razorpay_payment_id: paymentId } : {}),
            ...(existing.status === "pending" ? {
              trial_end_at: typeof entity.start_at === "number" && notes.trial === "yes" ? new Date(entity.start_at * 1000).toISOString() : null,
            } : {}),
            ...(typeof entity.current_end === "number"
              ? { current_period_end: new Date(entity.current_end * 1000).toISOString() }
              : existing.status === "pending" && typeof entity.start_at === "number"
                ? { current_period_end: new Date(entity.start_at * 1000).toISOString() } : {}),
          })
          .eq("id", existing.id);
        if (error) throw error;
        log("Updated payment", { id: existing.id, status });
      }
    }

    // Handle one-time payment events
    if (event === "payment.captured") {
      const payment = payload.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const amount = payment.amount ? Math.round(payment.amount / 100) : null;

      // Legacy one-time order path is retired (no code creates orders). A capture here is unexpected:
      // never grant access; record an audit row flagged for manual refund (replay-safe on payment id).
      if (orderId && !payment.subscription_id) {
        const { data: seen } = await supabase.from("payments").select("id").eq("refund_payment_id", paymentId).limit(1);
        if (!seen?.length) {
          await supabase.from("payments").insert({
            user_id: userId, razorpay_order_id: orderId, refund_payment_id: paymentId, tier, status: "orphan",
            needs_refund: true, amount,
          });
        }
        log("NEEDS_REFUND: unexpected one-time order capture (legacy path retired)", { orderId, paymentId, userId });
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
    // Return 200 to prevent Razorpay from retrying on our errors; no internal detail in the body.
    return new Response(JSON.stringify({ error: "processing_failed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
