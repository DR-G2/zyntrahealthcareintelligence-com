import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const SUPER_ADMIN_EMAIL = "gopalrock.naren@gmail.com";

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

    // Verify caller identity
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerEmail = userData.user.email;

    // Check admin role
    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("email", callerEmail)
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, user_id, tier, duration_days, reason } = await req.json();

    if (!user_id) throw new Error("user_id required");

    // Get target user's email
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user_id)
      .maybeSingle();
    const targetEmail = targetProfile?.email || "";

    // SECURITY: Block any action on super admin
    if (targetEmail === SUPER_ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Cannot modify Super Admin account" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const logAction = async (actionType: string, details: Record<string, unknown> = {}) => {
      await supabase.from("admin_activity_logs").insert({
        admin_email: callerEmail,
        action_type: actionType,
        target_user_id: user_id,
        target_user_email: targetEmail,
        details,
      });
    };

    if (action === "ban") {
      await supabase.from("profiles").update({ is_banned: true }).eq("id", user_id);
      await supabase.auth.admin.updateUserById(user_id, { ban_duration: "876000h" }); // ~100 years
      await logAction("BAN_USER", { reason: reason || "Admin action" });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "unban") {
      await supabase.from("profiles").update({ is_banned: false }).eq("id", user_id);
      await supabase.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      await logAction("UNBAN_USER");
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reset_password") {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: targetEmail,
      });
      if (error) throw error;
      await logAction("RESET_PASSWORD");
      return new Response(JSON.stringify({ success: true, recovery_link: data?.properties?.action_link }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_user") {
      // Only super_admin can delete users
      if (adminRole.role !== "super_admin") {
        return new Response(JSON.stringify({ error: "Only Super Admin can delete users" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Clean up user data
      await supabase.from("user_attempts").delete().eq("user_id", user_id);
      await supabase.from("bookmarks").delete().eq("user_id", user_id);
      await supabase.from("user_notes").delete().eq("user_id", user_id);
      await supabase.from("user_progress").delete().eq("user_id", user_id);
      await supabase.from("behavior_profiles").delete().eq("user_id", user_id);
      await supabase.from("performance_profiles").delete().eq("user_id", user_id);
      await supabase.from("study_plans").delete().eq("user_id", user_id);
      await supabase.from("chat_conversations").delete().eq("user_id", user_id);
      await supabase.from("station_attempts").delete().eq("user_id", user_id);
      await supabase.from("clinical_stations").delete().eq("user_id", user_id);
      await supabase.from("psychograph_history").delete().eq("user_id", user_id);
      await supabase.from("manual_overrides").delete().eq("user_id", user_id);
      await supabase.from("profiles").delete().eq("id", user_id);
      await supabase.auth.admin.deleteUser(user_id);
      await logAction("DELETE_USER");
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "grant_subscription") {
      const expires_at = duration_days
        ? new Date(Date.now() + duration_days * 86400000).toISOString()
        : null;
      const { error } = await supabase.from("manual_overrides").upsert({
        user_id,
        tier: tier || "full_access",
        granted_by: callerEmail,
        granted_at: new Date().toISOString(),
        expires_at,
      }, { onConflict: "user_id" });
      if (error) throw error;
      await logAction("GRANT_SUBSCRIPTION", { tier: tier || "full_access", duration_days });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "revoke_subscription") {
      const { error } = await supabase.from("manual_overrides").delete().eq("user_id", user_id);
      if (error) throw error;
      await logAction("REVOKE_SUBSCRIPTION");
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_logs") {
      // Only super_admin can view logs
      if (adminRole.role !== "super_admin") {
        return new Response(JSON.stringify({ error: "Only Super Admin can view activity logs" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data, error } = await supabase
        .from("admin_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return new Response(JSON.stringify({ logs: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Invalid action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
