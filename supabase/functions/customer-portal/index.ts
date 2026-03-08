import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Repurposed as cancel-subscription endpoint for Razorpay
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const { action } = await req.json();

    if (action === "cancel") {
      // Find user's active subscription payment
      const { data: payments } = await supabaseClient
        .from("payments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .not("razorpay_subscription_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!payments || payments.length === 0) {
        throw new Error("No active subscription found");
      }

      const payment = payments[0];
      const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
      const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
      const authString = btoa(`${keyId}:${keySecret}`);

      // Cancel subscription on Razorpay
      const cancelRes = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${payment.razorpay_subscription_id}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${authString}`,
          },
          body: JSON.stringify({ cancel_at_cycle_end: true }),
        }
      );

      if (!cancelRes.ok) {
        const err = await cancelRes.text();
        throw new Error(`Failed to cancel subscription: ${err}`);
      }

      // Mark as cancelled locally
      await supabaseClient
        .from("payments")
        .update({ status: "cancelled" })
        .eq("id", payment.id);

      return new Response(JSON.stringify({ success: true, message: "Subscription will be cancelled at end of billing cycle" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Invalid action. Use 'cancel'.");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
