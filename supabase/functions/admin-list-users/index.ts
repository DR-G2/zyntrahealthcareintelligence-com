import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims || claimsData.claims.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

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

    // Get payment info from local payments table
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("status", "active");

    const paymentMap: Record<string, any> = {};
    for (const p of payments || []) {
      paymentMap[p.user_id] = {
        tier: p.tier,
        status: p.status,
        razorpay_subscription_id: p.razorpay_subscription_id,
        created_at: p.created_at,
      };
    }

    const users = (profiles || []).map((p: any) => ({
      ...p,
      subscription: paymentMap[p.id] || null,
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
