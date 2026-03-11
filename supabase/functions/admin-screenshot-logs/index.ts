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

    const userEmail = claimsData.claims.email as string;

    // Validate admin role
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: adminRole } = await serviceClient.from("admin_roles").select("role").eq("email", userEmail).maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const page = body.page || 1;
    const pageSize = body.page_size || 50;
    const offset = (page - 1) * pageSize;

    // Get screenshot attempt logs
    const { data: logs, error: logsErr, count } = await serviceClient
      .from("system_error_logs")
      .select("*", { count: "exact" })
      .eq("error_type", "screenshot_attempt")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (logsErr) throw logsErr;

    // Get unique user_ids and fetch profiles
    const userIds = [...new Set((logs || []).map((l: any) => l.user_id).filter(Boolean))];
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, email, name")
        .in("id", userIds);
      for (const p of profiles || []) {
        profilesMap[p.id] = p;
      }
    }

    const entries = (logs || []).map((log: any) => ({
      id: log.id,
      user_id: log.user_id,
      email: profilesMap[log.user_id]?.email || log.user_email || "Unknown",
      name: profilesMap[log.user_id]?.name || null,
      trigger: (log.details as any)?.trigger || "unknown",
      page: (log.details as any)?.page || "/",
      ip_address: (log.details as any)?.ip_address || null,
      created_at: log.created_at,
    }));

    return new Response(JSON.stringify({ entries, total_count: count || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-screenshot-logs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
