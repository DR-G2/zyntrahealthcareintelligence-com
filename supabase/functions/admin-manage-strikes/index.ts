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

    const { action, user_id, reason } = await req.json();

    if (action === "list_all") {
      // Get all strike counts + watermark settings
      const { data: strikes } = await supabase
        .from("piracy_strikes")
        .select("user_id");

      const countMap: Record<string, number> = {};
      for (const s of strikes || []) {
        countMap[s.user_id] = (countMap[s.user_id] || 0) + 1;
      }

      const { data: settings } = await supabase
        .from("watermark_settings")
        .select("*");

      const settingsMap: Record<string, any> = {};
      for (const s of settings || []) {
        settingsMap[s.user_id] = s;
      }

      const userIds = new Set([...Object.keys(countMap), ...Object.keys(settingsMap)]);
      const users = Array.from(userIds).map((uid) => ({
        user_id: uid,
        strike_count: countMap[uid] || 0,
        suspended: settingsMap[uid]?.suspended ?? false,
        opacity_light: settingsMap[uid]?.opacity_light ?? 0.055,
      }));

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "issue") {
      if (!user_id || !reason) throw new Error("user_id and reason required");

      const { error } = await supabase.from("piracy_strikes").insert({
        user_id,
        reason,
        issued_by: userData.user.id,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "history") {
      if (!user_id) throw new Error("user_id required");

      const { data, error } = await supabase
        .from("piracy_strikes")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return new Response(JSON.stringify({ strikes: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
