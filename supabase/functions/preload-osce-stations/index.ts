import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { count = 10, exclude_ids = [], weak_areas = [] } = await req.json();

    // Fetch stations from the bank, prioritizing weak areas
    let query = supabase
      .from("clinical_stations")
      .select("id, scenario_title, scenario_data, candidate_instructions, examiner_instructions, marking_checklist, subject")
      .limit(count * 2); // Fetch extra to filter

    if (exclude_ids.length > 0) {
      query = query.not("id", "in", `(${exclude_ids.join(",")})`);
    }

    const { data: allStations, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!allStations || allStations.length === 0) {
      return new Response(JSON.stringify({ stations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sort: weak area stations first, then others
    const weakSet = new Set(weak_areas.map((w: string) => w.toLowerCase()));
    const sorted = allStations.sort((a: any, b: any) => {
      const aWeak = weakSet.has((a.subject || "").toLowerCase()) ? 0 : 1;
      const bWeak = weakSet.has((b.subject || "").toLowerCase()) ? 0 : 1;
      return aWeak - bWeak;
    });

    const selected = sorted.slice(0, count).map((s: any) => ({
      station_id: s.id,
      title: s.scenario_title,
      scenario_data: s.scenario_data,
      candidate_instructions: s.candidate_instructions,
      examiner_instructions: s.examiner_instructions,
      marking_checklist: s.marking_checklist,
      subject: s.subject,
      difficulty: "medium",
    }));

    return new Response(JSON.stringify({ stations: selected }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("preload-osce-stations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
