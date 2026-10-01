import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace("Bearer ", "");
    const _supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await _supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { psychograph, completed_subjects, station_number } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const availableSubjects = [
      "Cardiology", "Respiratory", "Gastrointestinal", "Neurology", "Endocrinology",
      "Renal", "Dermatology", "Psychiatry", "Paediatrics", "Obstetrics & Gynaecology",
      "Emergency Medicine", "Infectious Diseases", "Population Health", "Ethics & Law"
    ].filter(s => !completed_subjects.includes(s));

    const prompt = `Based on this candidate's psychograph from their OSCE performance, select the next station subject.

PSYCHOGRAPH:
- Cognitive Stability: ${psychograph.cognitive_stability}/100
- Emotional Reactivity: ${psychograph.emotional_reactivity}/100
- Time Compression Vulnerability: ${psychograph.time_compression_vulnerability}/100
- Silence Tolerance: ${psychograph.silence_tolerance}/100
- Delegation Confidence: ${psychograph.delegation_confidence}/100
- Structure Integrity: ${psychograph.structure_integrity}/100

Station ${station_number} of 16. Completed: ${completed_subjects.join(', ') || 'None yet'}.

Available subjects: ${availableSubjects.join(', ')}

SELECTION RULES:
- Low silence tolerance → minimal-response patient case (Psychiatry, Neurology)
- High emotional reactivity → breaking bad news (Oncology-related, Paediatrics)
- High time vulnerability → Emergency Medicine early
- Over-structuring → time-critical focused history
- Weak authority → Ethics & Law, consent scenarios
- Strong across domains → complex diagnostic ambiguity
- Progressive difficulty escalation through the circuit`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are the APPE Adaptive Circuit Engine. Select the optimal next OSCE station subject based on the candidate's psychological profile to target weaknesses and build resilience." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "select_station",
              description: "Select the next station subject",
              parameters: {
                type: "object",
                properties: {
                  next_subject: { type: "string", description: "The selected subject for the next station" },
                  reasoning: { type: "string", description: "Brief explanation of why this subject was selected based on the psychograph" },
                },
                required: ["next_subject", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "select_station" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Selection failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const selection = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(selection), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("select-adaptive-stations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
