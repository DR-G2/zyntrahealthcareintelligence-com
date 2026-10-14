import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { checkoutEnabled, CHECKOUT_DISABLED_BODY } from "../_shared/checkout-flag.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { firstChargeUnix, PLAN_PRICES, type PlanInterval } from "../_shared/billing-dates.ts";
import { checkoutDecision, pendingRowExpirable, resolveStalePending, PENDING_TTL_MS } from "../_shared/billing-lifecycle.ts";
import { cancelSubscriptionNow, fetchSubscription } from "../_shared/razorpay.ts";

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
  // Kill switch (fail closed): no order/subscription unless CHECKOUT_ENABLED === "true".
  if (!checkoutEnabled(Deno.env.get("CHECKOUT_ENABLED"))) return reply(CHECKOUT_DISABLED_BODY, 503);

  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) return reply({ error: "User not authenticated" }, 401);

    const { interval } = await req.json();
    if (interval !== "monthly" && interval !== "quarterly") return reply({ error: "Unknown plan interval" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

    // Stale pending rows (> 1h). Hank B1: only rows WITHOUT a Razorpay subscription id are expired blindly.
    // Rows with a subscription id are resolved against Razorpay so a live subscription is never orphaned.
    const { data: stale } = await admin.from("payments")
      .select("id,status,razorpay_subscription_id,created_at")
      .eq("user_id", user.id).eq("status", "pending")
      .lt("created_at", new Date(Date.now() - PENDING_TTL_MS).toISOString());
    for (const row of stale ?? []) {
      if (pendingRowExpirable(row)) {
        await admin.from("payments").update({ status: "expired" }).eq("id", row.id).eq("status", "pending");
        continue;
      }
      const rz = await fetchSubscription(row.razorpay_subscription_id!);
      const decision = resolveStalePending(rz?.status ?? null);
      if (decision === "cancel_then_expire") {
        if (!(await cancelSubscriptionNow(row.razorpay_subscription_id!, "create:stale-unauthorised"))) {
          // Retest 4 #1: flag for the hourly retry-razorpay-cancels job; row stays pending (blocks a 2nd checkout).
          console.error("[CREATE-RAZORPAY-ORDER] ALERT NEEDS_CANCEL: stale sub cancel failed; queued for retry", { id: row.id });
          await admin.from("payments").update({ needs_cancel: true }).eq("id", row.id);
          continue;
        }
      }
      if (decision !== "keep") await admin.from("payments").update({ status: "expired" }).eq("id", row.id).eq("status", "pending");
    }

    const { data: history, error: histErr } = await admin
      .from("payments")
      .select("id,status,trial_end_at,razorpay_subscription_id")
      .eq("user_id", user.id);
    if (histErr) {
      console.error("[CREATE-RAZORPAY] history lookup failed", histErr.message);
      return reply({ error: "Checkout failed. Please try again." }, 500);
    }
    const decision = checkoutDecision(history ?? []);
    if (!decision.ok) return reply({ error: decision.error }, 409);
    const withTrial = decision.trial;

    const planId = Deno.env.get(PLAN_ENV[interval as PlanInterval]);
    if (!planId) return reply({ error: "Checkout is not available yet" }, 503);

    // RACE GUARD: reserve a pending row BEFORE calling Razorpay. The unique partial index
    // payments_one_open_per_user (migration 20261014060000) lets only one open row exist per user,
    // so two simultaneous checkouts cannot both proceed.
    const price = PLAN_PRICES[interval as PlanInterval].price;
    const { data: pending, error: pendErr } = await admin.from("payments").insert({
      user_id: user.id, tier: "full_access", status: "pending", amount: price, plan_interval: interval,
    }).select("id").single();
    if (pendErr || !pending) {
      if ((pendErr as { code?: string } | null)?.code === "23505") return reply({ error: "A checkout or subscription is already in progress for this account." }, 409);
      console.error("[CREATE-RAZORPAY] pending insert failed", pendErr?.message);
      return reply({ error: "Checkout failed. Please try again." }, 500);
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
    const authString = btoa(`${keyId}:${keySecret}`);

    // New customers: 7-day trial, first charge at trial-end Sydney date 10:00 (same helper as the copy)
    // plus A$1 card check. Returning (lapsed/cancelled) customers: no trial, no A$1, charged now.
    const startAt = withTrial ? firstChargeUnix(new Date()) : null;

    const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Basic ${authString}` },
      body: JSON.stringify({
        plan_id: planId,
        total_count: TOTAL_COUNT[interval as PlanInterval],
        // N1: Razorpay itself refuses authorisation after the reservation TTL (matches pending-row expiry).
        expire_by: Math.floor((Date.now() + PENDING_TTL_MS) / 1000),
        ...(withTrial ? {
          start_at: startAt,
          addons: [{ item: { name: "Card check (non-refundable)", amount: CARD_CHECK_CENTS, currency: "AUD" } }],
        } : {}),
        notes: {
          user_id: user.id,
          email: user.email,
          tier: "full_access",
          interval,
          price_aud: price,
          trial: withTrial ? "yes" : "no",
          pending_payment_id: pending.id,
        },
      }),
    });
    if (!subRes.ok) {
      console.error("[CREATE-RAZORPAY] provider error", subRes.status, await subRes.text());
      await admin.from("payments").update({ status: "expired" }).eq("id", pending.id);
      return reply({ error: "Checkout could not be started. Please try again." }, 502);
    }
    const sub = await subRes.json();
    await admin.from("payments").update({ razorpay_subscription_id: sub.id }).eq("id", pending.id);

    return reply({
      subscription_id: sub.id, key_id: keyId, tier: "full_access", trial: withTrial,
      trial_end_at: startAt ? new Date(startAt * 1000).toISOString() : null,
    });
  } catch (error) {
    console.error("[CREATE-RAZORPAY]", error instanceof Error ? error.message : error);
    return reply({ error: "Checkout failed. Please try again." }, 500);
  }
});
