// Scheduled hourly by pg_cron (see migration 20261014040000). Emails ONE reminder per trial that ends
// 48–72h from now. Idempotent: payments.trial_reminder_sent_at is claimed atomically before sending
// and released if the send fails. Provider: Resend (already used by security-alert-email).
// Env: RESEND_API_KEY, BILLING_EMAIL_FROM, TRIAL_REMINDER_CRON_SECRET (must match the cron header).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { json, serviceClient } from "../_shared/auth.ts";
import { REMINDER_MAX_HOURS, REMINDER_MIN_HOURS, sendTrialReminders, type EmailProvider, type PaymentRow } from "../_shared/billing-lifecycle.ts";

const resend = (key: string, from: string): EmailProvider => ({
  async send(m) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}`);
  },
});

serve(async (req) => {
  const secret = Deno.env.get("TRIAL_REMINDER_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("BILLING_EMAIL_FROM");
  if (!key || !from) return json({ error: "Email provider not configured" }, 500);

  const db = serviceClient();
  const now = new Date();
  const { data, error } = await db
    .from("payments")
    .select("id,user_id,razorpay_subscription_id,status,tier,amount,trial_end_at,cancel_at_period_end,trial_reminder_sent_at")
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .is("trial_reminder_sent_at", null)
    .gte("trial_end_at", new Date(now.getTime() + REMINDER_MIN_HOURS * 3600_000).toISOString())
    .lt("trial_end_at", new Date(now.getTime() + REMINDER_MAX_HOURS * 3600_000).toISOString());
  if (error) return json({ error: error.message }, 500);

  const result = await sendTrialReminders((data ?? []) as PaymentRow[], {
    async claim(id, at) {
      const { data: c } = await db.from("payments").update({ trial_reminder_sent_at: at.toISOString() })
        .eq("id", id).is("trial_reminder_sent_at", null).select("id");
      return !!c?.length;
    },
    async release(id) {
      await db.from("payments").update({ trial_reminder_sent_at: null }).eq("id", id);
    },
    async emailFor(userId) {
      const { data: u } = await db.auth.admin.getUserById(userId);
      return u?.user?.email ?? null;
    },
  }, resend(key, from), now);
  return json(result);
});
