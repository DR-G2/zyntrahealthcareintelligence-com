import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  PAYPAL_PLANS,
  makeCustomId,
  paypalAccessToken,
  paypalFetch,
  planIdFor,
} from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SITE_URL = "https://www.zyntrahealthcareintelligence.com";

// Only redirect back to known app origins (prevents open redirects).
function resolveSiteUrl(req: Request): string {
  const configured = (Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  const origin = req.headers.get("Origin") || "";
  const allowed =
    /^https:\/\/(www\.)?zyntrahealthcareintelligence\.com$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    (configured !== "" && origin === configured);
  if (allowed) return origin;
  return configured || DEFAULT_SITE_URL;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Only the plan key is accepted from the client; price/plan are looked up server-side.
    const { tierKey } = await req.json();
    const plan = PAYPAL_PLANS[tierKey as string];
    if (!plan) throw new Error("Invalid plan");

    const siteUrl = resolveSiteUrl(req);
    const returnUrl = `${siteUrl}/pricing?paypal=return`;
    const cancelUrl = `${siteUrl}/pricing?paypal=cancel`;
    const customId = makeCustomId(user.id, tierKey);
    const accessToken = await paypalAccessToken();

    if (plan.kind === "order") {
      // One-time payment (lifetime) — PayPal Orders v2
      const order = await paypalFetch(accessToken, "/v2/checkout/orders", {
        method: "POST",
        headers: { "PayPal-Request-Id": crypto.randomUUID() },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: tierKey,
            custom_id: customId,
            description: `Zyntra ${plan.name}`,
            amount: { currency_code: "USD", value: plan.price },
          }],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "Zyntra",
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
                return_url: returnUrl,
                cancel_url: cancelUrl,
              },
            },
          },
        }),
      });

      const approve = (order.links || []).find((l: { rel?: string; href?: string }) => l.rel === "payer-action" || l.rel === "approve");
      if (!approve?.href) throw new Error("PayPal did not return an approval link");

      return new Response(JSON.stringify({
        order_id: order.id,
        approve_url: approve.href,
        amount: plan.price,
        currency: "USD",
        client_id: Deno.env.get("PAYPAL_CLIENT_ID") || "",
        tier: plan.tier,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Recurring (monthly / 3-month) — PayPal Subscriptions v1 with pre-created plan IDs
      const planId = planIdFor(plan);
      const sub = await paypalFetch(accessToken, "/v1/billing/subscriptions", {
        method: "POST",
        headers: { "PayPal-Request-Id": crypto.randomUUID() },
        body: JSON.stringify({
          plan_id: planId,
          custom_id: customId,
          subscriber: { email_address: user.email },
          application_context: {
            brand_name: "Zyntra",
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        }),
      });

      const approve = (sub.links || []).find((l: { rel?: string; href?: string }) => l.rel === "approve");
      if (!approve?.href) throw new Error("PayPal did not return an approval link");

      return new Response(JSON.stringify({
        subscription_id: sub.id,
        approve_url: approve.href,
        client_id: Deno.env.get("PAYPAL_CLIENT_ID") || "",
        tier: plan.tier,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-PAYPAL-ORDER] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
