import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const { categoryStats, perfProfile, examDate, daysUntilExam, weakAreas } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are an AMC (Australian Medical Council) exam preparation expert. Generate a personalized 7-day study plan.

User Performance Data:
- Days until exam: ${daysUntilExam ?? "Not set"}
- Exam date: ${examDate ?? "Not set"}
- Weak areas from profile: ${weakAreas?.join(", ") || "None identified"}
- Performance metrics: Readiness ${perfProfile?.readiness_score ?? 0}%, Clinical Accuracy ${perfProfile?.clinical_accuracy ?? 0}%, Stability ${perfProfile?.stability_score ?? 0}%, Time Sensitivity ${perfProfile?.time_sensitivity ?? 0}%, Confidence Gap ${perfProfile?.confidence_gap ?? 0}%
- Category performance: ${JSON.stringify(categoryStats || [])}

Generate a comprehensive, actionable study plan tailored to this student's specific weaknesses.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert AMC exam tutor. Return structured study plans using the provided tool." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_study_plan",
              description: "Create a structured 7-day study plan with focus areas and recommendations",
              parameters: {
                type: "object",
                properties: {
                  focus_areas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "maintain"] },
                        daily_questions: { type: "number" },
                        study_tip: { type: "string" },
                      },
                      required: ["category", "priority", "daily_questions", "study_tip"],
                      additionalProperties: false,
                    },
                  },
                  weekly_schedule: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        day: { type: "string" },
                        total_questions: { type: "number" },
                        topics: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              category: { type: "string" },
                              count: { type: "number" },
                              focus_note: { type: "string" },
                            },
                            required: ["category", "count", "focus_note"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["day", "total_questions", "topics"],
                      additionalProperties: false,
                    },
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tip: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["tip", "reason"],
                      additionalProperties: false,
                    },
                  },
                  motivation: { type: "string" },
                },
                required: ["focus_areas", "weekly_schedule", "recommendations", "motivation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_study_plan" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error:", status, text);
      return new Response(JSON.stringify({ error: "Failed to generate study plan" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured plan" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const plan = JSON.parse(toolCall.function.arguments);

    // Save to study_plans table
    const focusAreaNames = plan.focus_areas?.map((f: any) => f.category) || [];
    await supabase.from("study_plans").upsert(
      {
        user_id: userId,
        tasks: plan,
        focus_areas: focusAreaNames,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
