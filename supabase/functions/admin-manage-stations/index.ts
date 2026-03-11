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
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await supabase.from("admin_roles").select("role").eq("email", userData.user.email).maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { action, station_id, station_data, stations } = await req.json();

    if (action === "list") {
      const { data, error } = await supabase
        .from("clinical_stations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return new Response(JSON.stringify({ stations: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      if (!station_id || !station_data) throw new Error("Missing station_id or station_data");
      const { error } = await supabase.from("clinical_stations").update(station_data).eq("id", station_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!station_id) throw new Error("Missing station_id");
      const { error } = await supabase.from("clinical_stations").delete().eq("id", station_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import") {
      if (!Array.isArray(stations)) throw new Error("Expected array of stations");
      let imported = 0;
      const errors: string[] = [];
      for (const s of stations) {
        if (!s.subject || !s.scenario_title || !s.scenario_data) {
          errors.push(`Missing required fields for station: ${s.scenario_title || "unknown"}`);
          continue;
        }
        const { error } = await supabase.from("clinical_stations").insert({
          user_id: userData.user!.id,
          session_id: crypto.randomUUID(),
          subject: s.subject,
          scenario_title: s.scenario_title,
          scenario_data: s.scenario_data,
        });
        if (error) {
          errors.push(`${s.scenario_title}: ${error.message}`);
        } else {
          imported++;
        }
      }
      return new Response(JSON.stringify({ imported, errors }), {
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
