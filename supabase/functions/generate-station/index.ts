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

STRICT AMC CLINICAL EXAM FORMAT — the station MUST comply:

1. STATION STRUCTURE:
   - Reading time: 2 minutes (candidate reads instructions outside the room)
   - Station time: 8 minutes (candidate performs tasks inside the room)
   - The scenario must be completable within these time constraints

2. CANDIDATE INSTRUCTIONS:
   - Written in second person ("You are a doctor in...")
   - Setting (GP clinic, ED, ward, outpatient clinic)
   - Brief patient introduction (name, age, presenting complaint)
   - Specific tasks to perform (e.g. "Take a focused history", "Explain the diagnosis", "Discuss management options")
   - What NOT to do (e.g. "Do not perform a physical examination")

3. EXAMINER INSTRUCTIONS:
   - What to observe and mark
   - When to provide prompts if candidate is stuck
   - Key safety items that must be assessed
   - Time management guidance

4. SIMULATED PATIENT PERSONA:
   - Realistic demographics, occupation, social context
   - Emotional state and how it changes during consultation
   - Hidden agenda or concern the candidate must elicit
   - Specific responses to expected questions
   - Information to volunteer only if asked directly

5. MARKING CHECKLIST (scored items):
   - Communication skills (introduction, rapport, empathy, active listening)
   - History-taking completeness (presenting complaint, associated symptoms, red flags, PMHx, medications, social history)
   - Clinical reasoning (appropriate differentials, logical approach)
   - Management (correct plan, safety netting, follow-up)
   - Patient-centred care (checking understanding, addressing concerns)
   - Each item scored: 0 (not done), 1 (partially done), 2 (well done)

6. CLINICAL ACCURACY:
   - Follow Australian clinical guidelines (eTG, RACGP)
   - Use Australian healthcare system context (Medicare, PBS, referral pathways)
   - Include realistic examination findings and investigation results

For ${mode === 'adaptive' ? 'adaptive training (may include psychiatry, communication-heavy, or ethically complex scenarios)' : 'standard AMC Clinical Exam training'}.`;

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
          { role: "user", content: `Generate a complete AMC Clinical Exam OSCE station for: ${subject}. Include candidate instructions, examiner instructions, detailed patient persona, and a scored marking checklist.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_station",
              description: "Create a structured AMC Clinical Exam OSCE station scenario",
              parameters: {
                type: "object",
                properties: {
                  scenario_title: { type: "string", description: "Brief title of the scenario" },
                  candidate_instructions: { type: "string", description: "What the candidate reads during 2-min reading time — setting, patient intro, tasks" },
                  examiner_instructions: { type: "string", description: "Guidance for the examiner — what to observe, when to prompt, key safety items" },
                  reading_time_minutes: { type: "integer", description: "Reading time in minutes (default 2)" },
                  station_time_minutes: { type: "integer", description: "Station time in minutes (default 8)" },
                  patient_persona: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      age: { type: "integer" },
                      gender: { type: "string" },
                      occupation: { type: "string" },
                      presenting_complaint: { type: "string" },
                      history_of_presenting_illness: { type: "string" },
                      past_medical_history: { type: "string" },
                      medications: { type: "string" },
                      social_history: { type: "string" },
                      family_history: { type: "string" },
                      emotional_state: { type: "string", description: "Patient's emotional state and how it evolves during the consultation" },
                      hidden_agenda: { type: "string", description: "Concern or fear the patient won't reveal unless specifically asked" },
                      system_prompt: { type: "string", description: "AI system prompt for simulating this patient — include speech patterns, emotional cues, what to reveal when asked" },
                    },
                    required: ["name", "age", "gender", "occupation", "presenting_complaint", "history_of_presenting_illness", "past_medical_history", "medications", "social_history", "family_history", "emotional_state", "hidden_agenda", "system_prompt"],
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
                  marking_checklist: {
                    type: "array",
                    description: "Scored marking items for examiner assessment",
                    items: {
                      type: "object",
                      properties: {
                        domain: { type: "string", enum: ["communication", "history", "clinical_reasoning", "management", "patient_centred", "safety"] },
                        item: { type: "string", description: "What the examiner is assessing" },
                        max_score: { type: "integer", description: "Maximum score for this item (typically 2)" },
                      },
                      required: ["domain", "item", "max_score"],
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
                required: ["scenario_title", "candidate_instructions", "examiner_instructions", "reading_time_minutes", "station_time_minutes", "patient_persona", "examination_findings", "investigations", "management_actions", "marking_checklist", "marking_rubric"],
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
