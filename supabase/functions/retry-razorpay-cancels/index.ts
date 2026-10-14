// Gus Retest 4 #1. Scheduled hourly by pg_cron (migration 20261014061000). Retries Razorpay cancels that
// failed in razorpay-webhook / verify-razorpay-payment / create-razorpay-order (payments.needs_cancel).
// Clears the flag on success (incl. sub already cancelled/completed/expired at Razorpay, Gus R5); logs ALERT NEEDS_CANCEL on every failure so it is visible in function logs.
// Env: CANCEL_RETRY_CRON_SECRET (own secret; Vault cancel_retry_cron_secret, must match the cron header), RAZORPAY keys.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { json, serviceClient } from "../_shared/auth.ts";
import { timingSafeEqual } from "../_shared/signature.ts";
import { cancelSubscriptionNow } from "../_shared/razorpay.ts";

serve(async (req) => {
  const secret = Deno.env.get("CANCEL_RETRY_CRON_SECRET");
  if (!secret || !timingSafeEqual(req.headers.get("x-cron-secret") ?? "", secret)) return json({ error: "Unauthorized" }, 401);

  const db = serviceClient();
  const { data, error } = await db.from("payments")
    .select("id,razorpay_subscription_id").eq("needs_cancel", true).not("razorpay_subscription_id", "is", null)
    .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(100); // oldest first (Gus R5)
  if (error) return json({ error: error.message }, 500);

  let cancelled = 0, failed = 0;
  for (const row of data ?? []) {
    if (await cancelSubscriptionNow(row.razorpay_subscription_id!, "cron:retry")) {
      await db.from("payments").update({ needs_cancel: false }).eq("id", row.id);
      cancelled++;
    } else {
      failed++;
      console.error("[RETRY-RAZORPAY-CANCELS] ALERT NEEDS_CANCEL: retry failed", { id: row.id, sub: row.razorpay_subscription_id });
    }
  }
  return json({ checked: data?.length ?? 0, cancelled, failed });
});
