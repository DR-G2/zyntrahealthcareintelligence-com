import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { isAdmin, hasPaidAccess, safeLabel } from "../_shared/auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(await isAdmin(user.email ?? null)) && !(await hasPaidAccess(user.id))) {
      return new Response(JSON.stringify({ error: "Model-answer coaching is available on paid plans." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const station_id = typeof body.station_id === "string" ? body.station_id : null;
    const subject = safeLabel(body.subject, "General");
    const scenario_title = safeLabel(body.scenario_title, "Unknown", 160);
    const checklist_items = Array.isArray(body.checklist_items)
      ? body.checklist_items.filter((c: unknown) => typeof c === "string").slice(0, 30).map((c: string) => c.slice(0, 300))
      : [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are an AMC Clinical Exam expert examiner. Generate a "clear pass" model answer walkthrough for this OSCE station.

Station: ${scenario_title}
Subject: ${subject}
Checklist items: ${(checklist_items || []).map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

For each checklist item, provide:
- checklist_item: the item text
- ideal_response: exactly what a clear-pass candidate would say/do (be specific with actual dialogue)
- tips: a brief examiner tip`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an AMC2 OSCE examiner generating model answers. Return structured data via tool call." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_walkthrough",
            description: "Create model answer walkthrough steps",
            parameters: {
              type: "object",
              properties: {
                walkthrough: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      checklist_item: { type: "string" },
                      ideal_response: { type: "string" },
                      tips: { type: "string" },
                    },
                    required: ["checklist_item", "ideal_response", "tips"],
                  },
                },
              },
              required: ["walkthrough"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_walkthrough" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call");

    const { walkthrough } = JSON.parse(toolCall.function.arguments);

    // Cache in DB
    // Only cache against an existing station that the caller owns (or any station for admins)
    if (station_id) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: st } = await supabase.from("clinical_stations").select("id, user_id").eq("id", station_id).maybeSingle();
      const canCache = st && (st.user_id === user.id || (await isAdmin(user.email ?? null)));
      if (canCache) await supabase.from("model_answers").insert({
        station_id,
        subject: subject || "General",
        scenario_title: scenario_title || "Unknown",
        model_walkthrough: walkthrough,
      });
    }

    return new Response(JSON.stringify({ walkthrough }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-model-answer error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
