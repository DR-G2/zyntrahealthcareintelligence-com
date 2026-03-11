import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subject, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a clinical OSCE station generator for the AMC Clinical Exam. Generate a realistic clinical station scenario for the subject: ${subject}.

The station must be a consultation scenario where a medical candidate interviews a simulated patient. The scenario should be realistic, clinically accurate, and test clinical reasoning.

For ${mode === 'adaptive' ? 'adaptive training (may be psychiatry/communication focused)' : 'standard training'}.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a complete OSCE station for: ${subject}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_station",
              description: "Create a structured OSCE clinical station scenario",
              parameters: {
                type: "object",
                properties: {
                  scenario_title: { type: "string", description: "Brief title of the scenario" },
                  patient_persona: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      age: { type: "integer" },
                      gender: { type: "string" },
                      presenting_complaint: { type: "string" },
                      history_of_presenting_illness: { type: "string" },
                      past_medical_history: { type: "string" },
                      medications: { type: "string" },
                      social_history: { type: "string" },
                      family_history: { type: "string" },
                      emotional_state: { type: "string" },
                      hidden_agenda: { type: "string" },
                      system_prompt: { type: "string" },
                    },
                    required: ["name", "age", "gender", "presenting_complaint", "history_of_presenting_illness", "past_medical_history", "medications", "social_history", "family_history", "emotional_state", "hidden_agenda", "system_prompt"],
                  },
                  examination_findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        finding: { type: "string" },
                        is_relevant: { type: "boolean" },
                        result: { type: "string" },
                      },
                      required: ["finding", "is_relevant", "result"],
                    },
                  },
                  investigations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        investigation: { type: "string" },
                        is_appropriate: { type: "boolean" },
                        result: { type: "string" },
                      },
                      required: ["investigation", "is_appropriate", "result"],
                    },
                  },
                  management_actions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string" },
                        is_correct: { type: "boolean" },
                        priority: { type: "string", enum: ["essential", "recommended", "optional", "incorrect"] },
                      },
                      required: ["action", "is_correct", "priority"],
                    },
                  },
                  marking_rubric: {
                    type: "object",
                    properties: {
                      communication_criteria: { type: "array", items: { type: "string" } },
                      clinical_safety_items: { type: "array", items: { type: "string" } },
                      key_diagnoses: { type: "array", items: { type: "string" } },
                    },
                    required: ["communication_criteria", "clinical_safety_items", "key_diagnoses"],
                  },
                },
                required: ["scenario_title", "patient_persona", "examination_findings", "investigations", "management_actions", "marking_rubric"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_station" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);

      // Log error to system_error_logs
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await sb.from("system_error_logs").insert({
          error_type: "OSCE_STATION_GENERATION_FAILURE",
          details: { status, body: text.slice(0, 500), subject, mode },
        });
      } catch (_) { /* best effort */ }

      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Failed to generate station" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const scenario = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(scenario), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-station error:", e);

    // Log error
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await sb.from("system_error_logs").insert({
        error_type: "OSCE_STATION_GENERATION_EXCEPTION",
        details: { message: e instanceof Error ? e.message : "Unknown error" },
      });
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
