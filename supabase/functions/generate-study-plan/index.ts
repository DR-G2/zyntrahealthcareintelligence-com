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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data: existingPlan } = await supabaseAdmin
      .from("study_plans")
      .select("generated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingPlan?.generated_at && new Date(existingPlan.generated_at) >= monthStart) {
      const next = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
      const days = Math.max(1, Math.ceil((next.getTime() - Date.now()) / 86400000));
      return new Response(JSON.stringify({ error: `Next generation available in ${days} days` }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { categoryStats, perfProfile, examDate, daysUntilExam, weakAreas } = await req.json();

    const { data: attemptData } = await supabaseAdmin
      .from("user_attempts")
      .select("created_at, questions(category)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const lastPracticedMap: Record<string, string> = {};
    const now = new Date();
    if (attemptData) {
      for (const a of attemptData as any[]) {
        const cat = a.questions?.category;
        if (cat && !lastPracticedMap[cat]) {
          const daysAgo = Math.floor((now.getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24));
          lastPracticedMap[cat] = daysAgo === 0 ? "today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;
        }
      }
    }

    const allCategories = (categoryStats || []).map((s: any) => s.category);
    const practicedCategories = Object.keys(lastPracticedMap);
    const neverPracticed = allCategories.filter((c: string) => !practicedCategories.includes(c));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let populationInsight = "";
    const { data: trainingCtx } = await supabaseAdmin.from("ai_training_context").select("aggregate_data, candidate_count").limit(1).maybeSingle();
    if (trainingCtx?.aggregate_data) {
      const d = trainingCtx.aggregate_data as any;
      populationInsight = `\n\nPOPULATION INSIGHTS (${trainingCtx.candidate_count} candidates):\n- Overall population accuracy: ${d.mcq?.overall_accuracy}%\n- Hardest categories: ${d.mcq?.category_pass_rates?.slice(0, 5).map((c: any) => `${c.category} (${c.accuracy}%)`).join(", ")}\n- Common traps: ${d.behavior?.common_traps?.slice(0, 3).map((t: any) => t.trap).join(", ")}\nFactor these population-wide weak areas into the study plan.`;
    }

    const prompt = `You are an AMC exam preparation expert. Generate a personalized 7-day study plan.${populationInsight}\n\nUser Performance Data:\n- Days until exam: ${daysUntilExam ?? "Not set"}\n- Exam date: ${examDate ?? "Not set"}\n- Weak areas from profile: ${weakAreas?.join(", ") || "None identified"}\n- Performance metrics: Readiness ${perfProfile?.readiness_score ?? 0}%, Clinical Accuracy ${perfProfile?.clinical_accuracy ?? 0}%, Stability ${perfProfile?.stability_score ?? 0}%, Time Sensitivity ${perfProfile?.time_sensitivity ?? 0}%, Confidence Gap ${perfProfile?.confidence_gap ?? 0}%\n- Category performance: ${JSON.stringify(categoryStats || [])}\n\nSpaced Repetition Data:\n- Last practiced per category: ${JSON.stringify(lastPracticedMap)}\n- Categories never practiced: ${neverPracticed.length > 0 ? neverPracticed.join(", ") : "None"}\n\nUse spaced repetition principles. Include a spaced_repetition_note for each focus area.\n\nGenerate a comprehensive, actionable study plan tailored to this student's specific weaknesses.`;

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
              description: "Create a structured 7-day study plan",
              parameters: {
                type: "object",
                properties: {
                  focus_areas: { type: "array", items: { type: "object", properties: { category: { type: "string" }, priority: { type: "string" }, daily_questions: { type: "number" }, study_tip: { type: "string" }, spaced_repetition_note: { type: "string" } }, required: ["category", "priority", "daily_questions", "study_tip"] } },
                  weekly_schedule: { type: "array", items: { type: "object", properties: { day: { type: "string" }, total_questions: { type: "number" }, topics: { type: "array", items: { type: "object", properties: { category: { type: "string" }, count: { type: "number" }, focus_note: { type: "string" } }, required: ["category", "count", "focus_note"] } } }, required: ["day", "total_questions", "topics"] } },
                  recommendations: { type: "array", items: { type: "object", properties: { tip: { type: "string" }, reason: { type: "string" } }, required: ["tip", "reason"] } },
                  motivation: { type: "string" },
                },
                required: ["focus_areas", "weekly_schedule", "recommendations", "motivation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_study_plan" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Failed to generate study plan" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured plan" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const plan = JSON.parse(toolCall.function.arguments);
    const focusAreaNames = plan.focus_areas?.map((f: any) => f.category) || [];
    await supabase.from("study_plans").upsert(
      { user_id: userId, tasks: plan, focus_areas: focusAreaNames, generated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    return new Response(JSON.stringify(plan), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-study-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
