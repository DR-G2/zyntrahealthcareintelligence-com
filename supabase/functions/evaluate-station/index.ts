import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chat_transcript, checklist_responses, scenario_data, behavioral_signals } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    let populationNote = "";
    const { data: trainingCtx } = await supabase.from("ai_training_context").select("aggregate_data, candidate_count").limit(1).maybeSingle();
    if (trainingCtx?.aggregate_data) {
      const d = trainingCtx.aggregate_data as any;
      populationNote = ` Population benchmarks (${trainingCtx.candidate_count} candidates): avg OSCE score ${d.osce?.avg_score}%, overall MCQ accuracy ${d.mcq?.overall_accuracy}%.`;
    }

    const prompt = `Evaluate this OSCE station performance.

SCENARIO: ${scenario_data.scenario_title}

CHAT TRANSCRIPT (History Taking):
${JSON.stringify(chat_transcript)}

CHECKLIST RESPONSES:
Examination: ${JSON.stringify(checklist_responses.examination || [])}
Investigations: ${JSON.stringify(checklist_responses.investigations || [])}
Management: ${JSON.stringify(checklist_responses.management || [])}
Management Plan Text: ${checklist_responses.management_plan_text || 'Not provided'}

EXPECTED FINDINGS:
Examination: ${JSON.stringify(scenario_data.examination_findings)}
Investigations: ${JSON.stringify(scenario_data.investigations)}
Management: ${JSON.stringify(scenario_data.management_actions)}

MARKING RUBRIC:
${JSON.stringify(scenario_data.marking_rubric)}

BEHAVIORAL SIGNALS:
${JSON.stringify(behavioral_signals)}

Evaluate the candidate's performance across all domains. Consider both clinical accuracy and communication quality.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: `You are an AMC Clinical Exam evaluator. Provide structured assessment of OSCE station performance with psychographic profiling based on behavioral signals.${populationNote}` },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_evaluation",
              description: "Submit structured evaluation of the station attempt",
              parameters: {
                type: "object",
                properties: {
                  scores: {
                    type: "object",
                    properties: {
                      overall: { type: "number" },
                      communication: { type: "number" },
                      clinical_reasoning: { type: "number" },
                      clinical_safety: { type: "number" },
                      time_management: { type: "number" },
                      examination_accuracy: { type: "number" },
                      investigation_accuracy: { type: "number" },
                      management_accuracy: { type: "number" },
                    },
                    required: ["overall", "communication", "clinical_reasoning", "clinical_safety", "time_management", "examination_accuracy", "investigation_accuracy", "management_accuracy"],
                  },
                  psychograph: {
                    type: "object",
                    properties: {
                      cognitive_stability: { type: "number" },
                      emotional_reactivity: { type: "number" },
                      time_compression_vulnerability: { type: "number" },
                      silence_tolerance: { type: "number" },
                      delegation_confidence: { type: "number" },
                      structure_integrity: { type: "number" },
                    },
                    required: ["cognitive_stability", "emotional_reactivity", "time_compression_vulnerability", "silence_tolerance", "delegation_confidence", "structure_integrity"],
                  },
                  archetype: { type: "string", enum: ["Strategist", "Empathetic Communicator", "Rusher", "Overthinker", "Safety Focused", "Balanced Performer"] },
                  recommendations: { type: "array", items: { type: "string" } },
                  summary: { type: "string" },
                },
                required: ["scores", "psychograph", "archetype", "recommendations", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_evaluation" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);

      // Log error
      try {
        await supabase.from("system_error_logs").insert({
          error_type: "OSCE_EVALUATION_FAILURE",
          details: { status, body: text.slice(0, 500) },
        });
      } catch (_) { /* best effort */ }

      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Evaluation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const evaluation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-station error:", e);

    // Log error
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await sb.from("system_error_logs").insert({
        error_type: "OSCE_EVALUATION_EXCEPTION",
        details: { message: e instanceof Error ? e.message : "Unknown error" },
      });
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
