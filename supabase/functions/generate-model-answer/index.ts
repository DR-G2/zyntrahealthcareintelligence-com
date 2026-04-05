import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { station_id, subject, scenario_title, checklist_items } = await req.json();
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
    if (station_id) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("model_answers").insert({
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
