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

    const { category, difficulty, batch_size = 10 } = await req.json();
    const size = Math.min(batch_size, 20);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const selectedCategory = category || AMC_CATEGORIES[Math.floor(Math.random() * AMC_CATEGORIES.length)];
    const selectedDifficulty = difficulty || "moderate";

    // Fetch AI training context for population-level insights
    let trainingContextPrompt = "";
    const { data: trainingCtx } = await supabase.from("ai_training_context").select("aggregate_data, candidate_count").limit(1).maybeSingle();
    if (trainingCtx?.aggregate_data) {
      const d = trainingCtx.aggregate_data as any;
      trainingContextPrompt = `\n\nPOPULATION DATA (from ${trainingCtx.candidate_count} candidates):
- Overall accuracy: ${d.mcq?.overall_accuracy}%
- Avg time per question: ${d.mcq?.avg_time_seconds}s
- Answer change rate: ${d.mcq?.change_rate_percent}%
- Weakest categories: ${d.mcq?.category_pass_rates?.slice(0, 3).map((c: any) => `${c.category} (${c.accuracy}%)`).join(", ")}
- Common archetypes: ${Object.entries(d.behavior?.archetype_distribution || {}).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Top traps: ${d.behavior?.common_traps?.slice(0, 3).map((t: any) => `${t.trap} (${t.percent}%)`).join(", ")}

Use this data to calibrate question difficulty and focus on areas where candidates struggle most.`;
    }

    const systemPrompt = `You are an expert AMC (Australian Medical Council) CAT MCQ exam question writer with deep knowledge of Australian clinical practice. Generate ${size} high-quality clinical vignette MCQs for the category "${selectedCategory}" at "${selectedDifficulty}" difficulty.${trainingContextPrompt}

STRICT AMC QUALITY STANDARDS — every question MUST comply:

1. CLINICAL VIGNETTE FORMAT (minimum 120 words per stem):
   - Patient demographics (age, sex, occupation where relevant)
   - Presenting complaint with duration
   - Relevant past medical history, medications, allergies
   - Social history (smoking, alcohol, occupation) where clinically relevant
   - Physical examination findings (vitals + targeted system exam)
   - At least one investigation result (bloods, imaging, ECG, etc.)
   - Clear clinical question asking for diagnosis, investigation, or management

2. ANSWER OPTIONS — exactly 5 options (A–E):
   - Only ONE correct answer
   - All 4 distractors must be clinically plausible (real differentials or valid management options)
   - NO obviously wrong options, trick answers, or "none of the above"
   - Options should be similar in length and specificity
   - Distractors should represent common misconceptions or close differentials

3. AUSTRALIAN CLINICAL CONTEXT:
   - Follow Australian Therapeutic Guidelines (eTG) for treatment recommendations
   - Use RACGP, RANZCOG, RACP guidelines where applicable
   - Reference Medicare/PBS considerations where relevant
   - Use Australian drug names and dosing conventions
   - Reference Australian epidemiology and screening guidelines

4. DIFFICULTY CALIBRATION:
   - easy: single-step reasoning, classic presentation, clear answer
   - moderate: 2-3 step reasoning, atypical features, requires integration of findings
   - difficult: complex multi-system, subtle distinguishing features, management nuances

5. STRUCTURED EXPLANATIONS — every question must include:
   - Detailed diagnosis explanation with pathophysiology
   - First-line and gold-standard investigations with rationale
   - Best treatment per Australian guidelines with reference
   - 2-3 differential diagnoses with reasoning, investigation, and treatment
   - Why each incorrect option is wrong AND when it would be correct
   - 3-5 high-yield key takeaways for exam preparation

6. CLASSIFICATION:
   - subject: the broad medical specialty (e.g. "Cardiology")
   - subtopic: specific clinical entity (e.g. "Acute Coronary Syndrome")
   - system: body system (e.g. "Cardiovascular")
   - guideline_reference: specific guideline cited (e.g. "eTG - Acute Coronary Syndromes")`;

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
          { role: "user", content: `Generate ${size} AMC-standard MCQ questions for ${selectedCategory} (${selectedDifficulty} difficulty). Each vignette must be at least 120 words with complete clinical context. Return structured data.` }
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
                      question_text: { type: "string", description: "Full clinical vignette question stem (minimum 120 words with demographics, complaint, history, examination, investigations)" },
                      options: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 5,
                        maxItems: 5,
                        description: "Exactly 5 options prefixed with A. B. C. D. E. — all clinically plausible"
                      },
                      correct_answer: { type: "string", description: "Letter of correct answer (A-E)" },
                      explanation: { type: "string", description: "Comprehensive explanation of the correct answer with clinical reasoning" },
                      category: { type: "string", description: "Medical specialty (e.g. Cardiology)" },
                      subtopic: { type: "string", description: "Specific clinical entity (e.g. Acute Coronary Syndrome)" },
                      system_category: { type: "string", description: "Body system (e.g. Cardiovascular)" },
                      guideline_reference: { type: "string", description: "Australian guideline referenced (e.g. eTG - Acute Coronary Syndromes)" },
                      difficulty: { type: "string", enum: ["easy", "moderate", "difficult"] },
                      tags: { type: "array", items: { type: "string" } },
                      diagnosis_explanation: { type: "string", description: "Detailed pathophysiology and diagnosis explanation" },
                      first_line_investigation: { type: "string" },
                      gold_standard_investigation: { type: "string" },
                      best_treatment: { type: "string", description: "Best treatment per Australian guidelines" },
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
                    required: ["question_text", "options", "correct_answer", "explanation", "category", "subtopic", "system_category", "guideline_reference", "difficulty", "diagnosis_explanation", "first_line_investigation", "gold_standard_investigation", "best_treatment", "differential_diagnoses", "incorrect_answer_explanations", "key_takeaways"]
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

    // Validate quality: reject questions with <5 options or short stems
    const validQuestions = questions.filter((q: any) => {
      if (!q.options || q.options.length < 5) {
        console.warn(`Rejected question: fewer than 5 options`);
        return false;
      }
      const wordCount = (q.question_text || "").split(/\s+/).length;
      if (wordCount < 80) {
        console.warn(`Rejected question: stem too short (${wordCount} words)`);
        return false;
      }
      return true;
    });

    if (!validQuestions.length) throw new Error("All generated questions failed quality validation");

    // Insert into database (zyntra_id auto-assigned by trigger)
    const rows = validQuestions.map((q: any) => ({
      question_text: q.question_text,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      category: q.category || selectedCategory,
      subtopic: q.subtopic || null,
      system_category: q.system_category || null,
      guideline_reference: q.guideline_reference || null,
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

    const { data, error } = await supabase.from("questions").insert(rows).select("id, zyntra_id");
    if (error) throw new Error(`DB insert error: ${error.message}`);

    return new Response(JSON.stringify({ 
      success: true, 
      count: data.length,
      rejected: questions.length - validQuestions.length,
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
