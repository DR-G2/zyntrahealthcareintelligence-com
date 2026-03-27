import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify admin
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("email", user.email)
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Not an admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, body, category = "content", cta_label, cta_route, target_scope = "all" } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "Title and body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target users based on scope
    let userIds: string[] = [];

    if (target_scope === "all") {
      const { data } = await supabase.from("profiles").select("id").eq("is_banned", false);
      userIds = (data || []).map((p) => p.id);
    } else if (target_scope === "paid") {
      // Users with active payments or manual overrides
      const { data: paidUsers } = await supabase
        .from("payments")
        .select("user_id")
        .eq("status", "active");
      const { data: overrideUsers } = await supabase
        .from("manual_overrides")
        .select("user_id");
      const paidSet = new Set([
        ...(paidUsers || []).map((p) => p.user_id),
        ...(overrideUsers || []).map((p) => p.user_id),
      ]);
      userIds = Array.from(paidSet);
    } else if (target_scope === "free") {
      const { data: allUsers } = await supabase.from("profiles").select("id").eq("is_banned", false);
      const { data: paidUsers } = await supabase.from("payments").select("user_id").eq("status", "active");
      const { data: overrideUsers } = await supabase.from("manual_overrides").select("user_id");
      const paidSet = new Set([
        ...(paidUsers || []).map((p) => p.user_id),
        ...(overrideUsers || []).map((p) => p.user_id),
      ]);
      userIds = (allUsers || []).filter((u) => !paidSet.has(u.id)).map((u) => u.id);
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent_to: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch insert notifications for all target users
    const notifications = userIds.map((uid) => ({
      user_id: uid,
      type: "broadcast",
      category,
      title,
      body,
      cta_label: cta_label || null,
      cta_route: cta_route || null,
      icon: category === "content" ? "zap" : category === "admin" ? "bell" : "target",
      priority: 3,
      metadata: { sent_by: user.email, target_scope },
    }));

    // Insert in batches of 500
    for (let i = 0; i < notifications.length; i += 500) {
      const batch = notifications.slice(i, i + 500);
      await supabase.from("training_notifications").insert(batch);
    }

    return new Response(
      JSON.stringify({ sent_to: userIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-send-notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
