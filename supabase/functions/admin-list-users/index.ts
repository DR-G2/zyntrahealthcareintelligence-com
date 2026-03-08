import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const ADMIN_EMAIL = "gopalrock.naren@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || userData.user?.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, name, created_at, onboarding_complete, exam_date, user_type");
    if (profilesError) throw profilesError;

    // Get manual overrides
    const { data: overrides } = await supabase.from("manual_overrides").select("*");
    const overrideMap: Record<string, any> = {};
    for (const o of overrides || []) {
      overrideMap[o.user_id] = o;
    }

    // Get subscription info from Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let subscriptionMap: Record<string, any> = {};

    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const subscriptions = await stripe.subscriptions.list({ status: "active", limit: 100 });
      
      for (const sub of subscriptions.data) {
        const customer = await stripe.customers.retrieve(sub.customer as string) as any;
        if (customer.email) {
          subscriptionMap[customer.email] = {
            tier: sub.items.data[0]?.price?.id || "unknown",
            product_id: sub.items.data[0]?.price?.product || null,
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          };
        }
      }
    }

    const users = (profiles || []).map((p: any) => ({
      ...p,
      subscription: subscriptionMap[p.email] || null,
      override: overrideMap[p.id] || null,
    }));

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
