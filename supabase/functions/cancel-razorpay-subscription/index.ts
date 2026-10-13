// One-click cancel (Settings > Billing). Verifies the caller's JWT and that the subscription is theirs
// (payments row user_id AND Razorpay notes.user_id), then cancels at Razorpay:
//   - still in trial  -> cancel immediately, no A$39/A$99 charge ever made
//   - paid period     -> cancel at cycle end; access continues to current_end
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, json, requireUser, serviceClient } from "../_shared/auth.ts";
import { authorizeCancel, planCancel, type PaymentRow, type RazorpaySub } from "../_shared/billing-lifecycle.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const caller = await requireUser(req);
  if (caller instanceof Response) return caller;

  try {
    const db = serviceClient();
    // Only the caller's own rows are ever considered; no subscription id is accepted from the body.
    const { data: rows, error } = await db
      .from("payments")
      .select("id,user_id,razorpay_subscription_id,status,tier,amount,trial_end_at,current_period_end,cancel_at_period_end")
      .eq("user_id", caller.userId)
      .not("razorpay_subscription_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = (rows?.[0] ?? null) as PaymentRow | null;

    const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
    const auth = `Basic ${btoa(`${keyId}:${keySecret}`)}`;

    let sub: RazorpaySub | null = null;
    if (row?.razorpay_subscription_id) {
      const r = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(row.razorpay_subscription_id)}`, { headers: { Authorization: auth } });
      if (r.ok) sub = await r.json();
    }
    const authz = authorizeCancel(caller.userId, row, sub);
    if (!authz.ok) return json({ error: authz.error }, authz.status);

    const plan = planCancel(sub!);
    const c = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(sub!.id)}/cancel`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ cancel_at_cycle_end: plan.cancelAtCycleEnd }),
    });
    if (!c.ok) throw new Error("Provider could not cancel the subscription");

    const { error: upErr } = await db.from("payments").update({
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
      current_period_end: plan.accessEndsAt.toISOString(),
      ...(plan.inTrial ? { status: "cancelled" } : {}),
    }).eq("id", row!.id).eq("user_id", caller.userId);
    if (upErr) throw upErr;

    return json({ cancelled: true, in_trial: plan.inTrial, access_ends_at: plan.accessEndsAt.toISOString() });
  } catch (e) {
    console.error("[CANCEL-RAZORPAY]", e instanceof Error ? e.message : e);
    return json({ error: "Could not cancel right now. Please try again or contact support." }, 500);
  }
});
