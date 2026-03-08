import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content_text, type, subject } = await req.json();
    if (!content_text || !type) {
      return new Response(JSON.stringify({ error: "content_text and type are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt =
      type === "mcq"
        ? `You are a medical exam question generator specializing in the AMC (Australian Medical Council) exam. Given clinical content, generate 5-10 high-quality MCQ questions. Each question must have a clinical vignette style, 5 answer options (A-E), and be exam-realistic. Focus on Australian clinical guidelines.`
        : `You are a clinical OSCE station generator for the AMC exam. Given a clinical scenario, generate a complete OSCE station with: scenario_title, subject, patient briefing, examiner instructions, a checklist of 8-12 items to assess, and expected findings. Follow Australian clinical guidelines.`;

    const tools =
      type === "mcq"
        ? [
            {
              type: "function",
              function: {
                name: "generate_mcq_questions",
                description: "Generate structured MCQ questions from clinical content",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question_text: { type: "string" },
                          options: {
                            type: "object",
                            properties: {
                              A: { type: "string" },
                              B: { type: "string" },
                              C: { type: "string" },
                              D: { type: "string" },
                              E: { type: "string" },
                            },
                            required: ["A", "B", "C", "D", "E"],
                          },
                          correct_answer: { type: "string", enum: ["A", "B", "C", "D", "E"] },
                          explanation: { type: "string" },
                          category: { type: "string" },
                          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                          key_takeaways: { type: "array", items: { type: "string" } },
                          differential_diagnoses: { type: "array", items: { type: "string" } },
                        },
                        required: ["question_text", "options", "correct_answer", "explanation", "category", "difficulty"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["questions"],
                  additionalProperties: false,
                },
              },
            },
          ]
        : [
            {
              type: "function",
              function: {
                name: "generate_osce_station",
                description: "Generate a structured OSCE station from a clinical scenario",
                parameters: {
                  type: "object",
                  properties: {
                    station: {
                      type: "object",
                      properties: {
                        scenario_title: { type: "string" },
                        subject: { type: "string" },
                        patient_briefing: { type: "string" },
                        examiner_instructions: { type: "string" },
                        opening_statement: { type: "string" },
                        patient_history: {
                          type: "object",
                          properties: {
                            presenting_complaint: { type: "string" },
                            history_of_presenting_illness: { type: "string" },
                            past_medical_history: { type: "string" },
                            medications: { type: "string" },
                            social_history: { type: "string" },
                            family_history: { type: "string" },
                          },
                          required: ["presenting_complaint", "history_of_presenting_illness"],
                        },
                        checklist: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              item: { type: "string" },
                              category: { type: "string" },
                              weight: { type: "number" },
                            },
                            required: ["item", "category"],
                          },
                        },
                        expected_diagnosis: { type: "string" },
                        key_findings: { type: "array", items: { type: "string" } },
                      },
                      required: ["scenario_title", "subject", "patient_briefing", "opening_statement", "patient_history", "checklist", "expected_diagnosis"],
                      additionalProperties: false,
                    },
                  },
                  required: ["station"],
                  additionalProperties: false,
                },
              },
            },
          ];

    const toolChoice =
      type === "mcq"
        ? { type: "function", function: { name: "generate_mcq_questions" } }
        : { type: "function", function: { name: "generate_osce_station" } };

    const userPrompt = subject
      ? `Subject area: ${subject}\n\nContent:\n${content_text}`
      : `Content:\n${content_text}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No structured output received" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("feed-to-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
