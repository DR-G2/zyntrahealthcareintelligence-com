import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { questions } = await req.json();
    if (!Array.isArray(questions) || !questions.length) {
      throw new Error("Expected 'questions' array");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let successCount = 0;
    const errors: string[] = [];

    // Process in batches of 50
    for (let i = 0; i < questions.length; i += 50) {
      const batch = questions.slice(i, i + 50);
      const rows = batch.map((q: any, idx: number) => {
        if (!q.question_text || !q.options || !q.correct_answer) {
          errors.push(`Question ${i + idx}: missing required fields`);
          return null;
        }
        return {
          question_text: q.question_text,
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
          category: q.category || "Uncategorized",
          difficulty: q.difficulty || "medium",
          tags: q.tags || [],
          diagnosis_explanation: q.diagnosis_explanation || null,
          first_line_investigation: q.first_line_investigation || null,
          gold_standard_investigation: q.gold_standard_investigation || null,
          best_treatment: q.best_treatment || null,
          differential_diagnoses: q.differential_diagnoses || [],
          incorrect_answer_explanations: q.incorrect_answer_explanations || {},
          key_takeaways: q.key_takeaways || [],
          clinical_vignette: q.clinical_vignette ?? true,
          question_type: q.question_type || "mcq",
          subtopic: q.subtopic || null,
          guideline_reference: q.guideline_reference || null,
          system_category: q.system_category || null,
        };
      }).filter(Boolean);

      if (rows.length) {
        const { data, error } = await supabase.from("questions").insert(rows).select("id");
        if (error) {
          errors.push(`Batch ${i}-${i + rows.length}: ${error.message}`);
        } else {
          successCount += data.length;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, imported: successCount, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("import-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
