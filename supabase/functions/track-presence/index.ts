import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email as string | undefined;
    const body = await req.json().catch(() => ({}));
    const currentPage = body.current_page || "/";
    const isOnline = body.is_online !== false;
    const screenshotAttempt = body.screenshot_attempt === true;
    const screenshotTrigger = body.screenshot_trigger || null;

    // Extract IP from headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") ||
               null;

    const { error } = await supabase.from("user_presence").upsert(
      {
        user_id: userId,
        current_page: currentPage,
        is_online: isOnline,
        last_seen_at: new Date().toISOString(),
        ip_address: ip,
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;

    // Log screenshot attempt — skip for admin users (server-side guard)
    if (screenshotAttempt) {
      const serviceClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Check if user is an admin — if so, skip logging entirely
      const { data: adminRole } = await serviceClient
        .from("admin_roles")
        .select("role")
        .eq("email", userEmail || "")
        .maybeSingle();

      if (!adminRole) {
        await serviceClient.from("system_error_logs").insert({
          error_type: "screenshot_attempt",
          user_id: userId,
          details: {
            trigger: screenshotTrigger,
            page: currentPage,
            ip_address: ip,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("track-presence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
