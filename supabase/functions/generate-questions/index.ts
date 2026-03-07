import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AMC_CATEGORIES = [
  "Cardiology", "Respiratory", "Gastroenterology", "Neurology", "Endocrinology",
  "Nephrology", "Rheumatology", "Haematology", "Infectious Disease", "Dermatology",
  "Psychiatry", "Obstetrics", "Gynaecology", "Paediatrics", "Surgery",
  "Ophthalmology", "ENT", "Emergency Medicine", "Pharmacology"
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { category, difficulty, batch_size = 10 } = await req.json();
    const size = Math.min(batch_size, 20);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const selectedCategory = category || AMC_CATEGORIES[Math.floor(Math.random() * AMC_CATEGORIES.length)];
    const selectedDifficulty = difficulty || "medium";

    const systemPrompt = `You are an expert AMC (Australian Medical Council) exam question writer. Generate ${size} high-quality clinical vignette MCQs for the category "${selectedCategory}" at "${selectedDifficulty}" difficulty.

Each question MUST follow AMC exam format:
- Long clinical vignette stem with patient demographics, presenting complaint, history, examination findings, and relevant investigations
- 5 answer options (A-E) that are clinically plausible
- Follow Australian clinical guidelines and local epidemiology
- Include red flags and patient safety considerations

For each question provide the COMPLETE structured analysis following this framework:
1. Diagnosis explanation with first-line investigation, gold standard investigation, and best treatment
2. 2-3 differential diagnoses with reasoning, investigation, and treatment for each
3. Why each incorrect option is wrong AND when it would be correct
4. 3-5 key takeaways (high-yield exam points)`;

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
          { role: "user", content: `Generate ${size} AMC MCQ questions for ${selectedCategory} (${selectedDifficulty} difficulty). Return structured data.` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_questions",
            description: "Save generated AMC MCQ questions to the database",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question_text: { type: "string", description: "Full clinical vignette question stem (minimum 100 words)" },
                      options: {
                        type: "array",
                        items: { type: "string" },
                        description: "5 options prefixed with A. B. C. D. E."
                      },
                      correct_answer: { type: "string", description: "Letter of correct answer (A-E)" },
                      explanation: { type: "string", description: "Brief explanation of the correct answer" },
                      category: { type: "string" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                      tags: { type: "array", items: { type: "string" } },
                      diagnosis_explanation: { type: "string", description: "Detailed explanation of the diagnosis" },
                      first_line_investigation: { type: "string" },
                      gold_standard_investigation: { type: "string" },
                      best_treatment: { type: "string" },
                      differential_diagnoses: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            diagnosis: { type: "string" },
                            reasoning: { type: "string" },
                            investigation: { type: "string" },
                            treatment: { type: "string" }
                          },
                          required: ["diagnosis", "reasoning", "investigation", "treatment"]
                        }
                      },
                      incorrect_answer_explanations: {
                        type: "object",
                        description: "Map of option letter to {why_wrong, when_correct}",
                        additionalProperties: {
                          type: "object",
                          properties: {
                            why_wrong: { type: "string" },
                            when_correct: { type: "string" }
                          },
                          required: ["why_wrong", "when_correct"]
                        }
                      },
                      key_takeaways: { type: "array", items: { type: "string" } }
                    },
                    required: ["question_text", "options", "correct_answer", "explanation", "category", "difficulty", "diagnosis_explanation", "first_line_investigation", "gold_standard_investigation", "best_treatment", "differential_diagnoses", "incorrect_answer_explanations", "key_takeaways"]
                  }
                }
              },
              required: ["questions"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "save_questions" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);
    const questions = parsed.questions;

    if (!questions?.length) throw new Error("No questions generated");

    // Insert into database
    const rows = questions.map((q: any) => ({
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      category: q.category || selectedCategory,
      difficulty: q.difficulty || selectedDifficulty,
      tags: q.tags || [],
      diagnosis_explanation: q.diagnosis_explanation,
      first_line_investigation: q.first_line_investigation,
      gold_standard_investigation: q.gold_standard_investigation,
      best_treatment: q.best_treatment,
      differential_diagnoses: q.differential_diagnoses || [],
      incorrect_answer_explanations: q.incorrect_answer_explanations || {},
      key_takeaways: q.key_takeaways || [],
      clinical_vignette: true,
    }));

    const { data, error } = await supabase.from("questions").insert(rows).select("id");
    if (error) throw new Error(`DB insert error: ${error.message}`);

    return new Response(JSON.stringify({ 
      success: true, 
      count: data.length, 
      category: selectedCategory,
      difficulty: selectedDifficulty 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
