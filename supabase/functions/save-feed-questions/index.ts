import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Service role client for inserts
    const supabase = createClient(supabaseUrl, serviceKey);

    const { type, questions, station } = await req.json();

    if (type === "mcq" && Array.isArray(questions) && questions.length > 0) {
      const rows = questions.map((q: any) => ({
        question_text: q.question_text,
        options: q.options || {},
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        category: q.category || "General",
        difficulty: q.difficulty || "medium",
        key_takeaways: q.key_takeaways || [],
        differential_diagnoses: q.differential_diagnoses || [],
        clinical_vignette: true,
        tags: ["feed-generated"],
      }));

      const { data, error } = await supabase.from("questions").insert(rows).select("id");
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, saved: data.length, ids: data.map((r: any) => r.id) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "osce" && station) {
      const { data, error } = await supabase.from("clinical_stations").insert({
        user_id: userId,
        session_id: crypto.randomUUID(),
        scenario_title: station.scenario_title || "Feed Station",
        subject: station.subject || "General",
        scenario_data: station,
      }).select("id");
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, id: data[0].id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid type or missing data");
  } catch (e: any) {
    console.error("save-feed-questions error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
