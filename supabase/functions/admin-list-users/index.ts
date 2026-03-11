import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await supabase.from("admin_roles").select("role").eq("email", userData.user.email).maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const page = Math.max(1, body.page || 1);
    const pageSize = Math.min(100, Math.max(1, body.page_size || 50));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Get total count
    const { count: totalCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Get paginated profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, name, created_at, onboarding_complete, exam_date, user_type, is_banned")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (profilesError) throw profilesError;

    const userIds = (profiles || []).map((p: any) => p.id);

    const { data: overrides } = await supabase.from("manual_overrides").select("*").in("user_id", userIds);
    const overrideMap: Record<string, any> = {};
    for (const o of overrides || []) {
      overrideMap[o.user_id] = o;
    }

    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .eq("status", "active")
      .in("user_id", userIds);

    const paymentMap: Record<string, any> = {};
    for (const p of payments || []) {
      paymentMap[p.user_id] = {
        tier: p.tier,
        status: p.status,
        razorpay_subscription_id: p.razorpay_subscription_id,
        created_at: p.created_at,
      };
    }

    const { data: presenceData } = await supabase.from("user_presence").select("user_id, last_seen_at, is_online").in("user_id", userIds);
    const presenceMap: Record<string, any> = {};
    for (const p of presenceData || []) {
      presenceMap[p.user_id] = { last_seen_at: p.last_seen_at, is_online: p.is_online };
    }

    const users = (profiles || []).map((p: any) => ({
      ...p,
      subscription: paymentMap[p.id] || null,
      override: overrideMap[p.id] || null,
      presence: presenceMap[p.id] || null,
    }));

    return new Response(JSON.stringify({ users, total_count: totalCount || 0, page, page_size: pageSize }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
