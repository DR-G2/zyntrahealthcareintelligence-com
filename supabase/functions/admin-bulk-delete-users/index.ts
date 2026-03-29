import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const SUPER_ADMIN_EMAIL = "gopalrock.naren@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const callerEmail = userData.user.email;

    // Only super_admin can bulk delete
    const { data: adminRole } = await supabase.from("admin_roles").select("role").eq("email", callerEmail).maybeSingle();
    if (!adminRole || adminRole.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Only Super Admin can bulk delete users" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user_ids } = await req.json();
    if (!Array.isArray(user_ids) || !user_ids.length) {
      return new Response(JSON.stringify({ error: "Expected 'user_ids' array" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get emails for all targets, block super admin deletion
    const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", user_ids);
    const profileMap: Record<string, string> = {};
    for (const p of profiles || []) {
      profileMap[p.id] = p.email || "";
    }

    const results: { user_id: string; email: string; status: string; error?: string }[] = [];

    const deleteTables = [
      "user_attempts", "bookmarks", "user_notes", "user_progress",
      "behavior_profiles", "performance_profiles", "study_plans",
      "chat_conversations", "station_attempts", "clinical_stations",
      "psychograph_history", "manual_overrides", "push_subscriptions",
      "active_sessions", "readiness_dna", "subject_dna", "feed_submissions",
      "station_bookmarks", "station_notes", "user_usage_logs",
      "user_legal_acceptance", "watermark_settings", "piracy_strikes",
    ];

    for (const uid of user_ids) {
      const email = profileMap[uid] || "";

      if (email === SUPER_ADMIN_EMAIL) {
        results.push({ user_id: uid, email, status: "skipped", error: "Cannot delete Super Admin" });
        continue;
      }

      try {
        // Clean up related data
        for (const table of deleteTables) {
          const col = table === "profiles" ? "id" : "user_id";
          await supabase.from(table).delete().eq(col, uid);
        }
        // Delete profile and auth user
        await supabase.from("profiles").delete().eq("id", uid);
        await supabase.auth.admin.deleteUser(uid);

        results.push({ user_id: uid, email, status: "deleted" });
      } catch (e: any) {
        results.push({ user_id: uid, email, status: "error", error: e.message });
      }
    }

    // Log the bulk action
    await supabase.from("admin_activity_logs").insert({
      admin_email: callerEmail,
      action_type: "BULK_DELETE_USERS",
      details: {
        total: user_ids.length,
        deleted: results.filter(r => r.status === "deleted").length,
        skipped: results.filter(r => r.status === "skipped").length,
        errors: results.filter(r => r.status === "error").length,
      },
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
