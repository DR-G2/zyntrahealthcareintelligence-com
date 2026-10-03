import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authHeader?.startsWith("Bearer ") || !supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

    const { data: existingPlan, error: existingPlanError } = await supabaseAdmin
      .from("study_plans")
      .select("generated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingPlanError) throw existingPlanError;

    if (existingPlan?.generated_at && new Date(existingPlan.generated_at) >= monthStart) {
      const days = Math.max(1, Math.ceil((nextMonth.getTime() - Date.now()) / 86400000));
      return json({
        error: `Next generation available in ${days} days`,
        generated_at: existingPlan.generated_at,
        next_generation_at: nextMonth.toISOString(),
      }, 429);
    }

    const { examDate = null, daysUntilExam = null, weakAreas = [] } = await req.json();

    const [attemptsRes, subjectRes, dnaRes, behaviourRes, trainingRes] = await Promise.all([
      supabaseAdmin
        .from("user_attempts")
        .select("created_at, is_correct, confidence_level, answer_changes_count, time_taken_seconds, questions(category, subtopic)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("subject_dna")
        .select("subject, accuracy, attempt_count, avg_time, stability, gap_score")
        .eq("user_id", userId)
        .order("accuracy", { ascending: true }),
      supabaseAdmin
        .from("readiness_dna")
        .select("readiness_score, clinical_accuracy, answer_stability, time_management, confidence_calibration, distance_from_ideal, attempt_count")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("behavior_profiles")
        .select("archetype, rush_index, hesitation_index, fatigue_index, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("ai_training_context")
        .select("aggregate_data, candidate_count")
        .limit(1)
        .maybeSingle(),
    ]);

    if (attemptsRes.error) throw attemptsRes.error;
    if (subjectRes.error) throw subjectRes.error;
    if (dnaRes.error && dnaRes.error.code !== "PGRST116") throw dnaRes.error;
    if (behaviourRes.error && behaviourRes.error.code !== "PGRST116") throw behaviourRes.error;

    const attempts = attemptsRes.data || [];
    const categoryStats = (subjectRes.data || []).map((row: any) => ({
      category: row.subject,
      correct: Math.round(Number(row.attempt_count || 0) * Number(row.accuracy || 0) / 100),
      total: Number(row.attempt_count || 0),
      accuracy: Math.round(Number(row.accuracy || 0)),
      priority: Number(row.accuracy || 0) < 60 ? "high" : Number(row.accuracy || 0) < 80 ? "medium" : "maintain",
      avg_time: Number(row.avg_time || 0),
      stability: Number(row.stability || 0),
      gap_score: Number(row.gap_score || 0),
    }));
    const recent = attempts.slice(0, 20);
    const confidenceAttempts = recent.filter((a: any) => a.confidence_level != null);
    const confidenceSummary = confidenceAttempts.length
      ? {
          attempts: confidenceAttempts.length,
          average: Number((confidenceAttempts.reduce((s: number, a: any) => s + Number(a.confidence_level), 0) / confidenceAttempts.length).toFixed(2)),
          highConfidenceWrong: confidenceAttempts.filter((a: any) => Number(a.confidence_level) >= 4 && !a.is_correct).length,
          lowConfidenceCorrect: confidenceAttempts.filter((a: any) => Number(a.confidence_level) <= 2 && a.is_correct).length,
        }
      : { attempts: 0, average: null, highConfidenceWrong: 0, lowConfidenceCorrect: 0 };

    const lastPracticedMap: Record<string, string> = {};
    const now = new Date();
    for (const a of attempts as any[]) {
      const category = a.questions?.category;
      if (category && !lastPracticedMap[category]) {
        const daysAgo = Math.floor((now.getTime() - new Date(a.created_at).getTime()) / 86400000);
        lastPracticedMap[category] = daysAgo === 0 ? "today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;
      }
    }

    const allCategories = (categoryStats as any[]).map((s: any) => s.category);
    const neverPracticed = allCategories.filter((c: string) => !Object.keys(lastPracticedMap).includes(c));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let populationInsight = "";
    const trainingCtx = trainingRes.data;
    if (trainingCtx?.aggregate_data) {
      const d = trainingCtx.aggregate_data as any;
      populationInsight = `\nPopulation context may be used only to balance coverage, never to expose another candidate's data. Candidate count: ${trainingCtx.candidate_count}. Overall population accuracy: ${d.mcq?.overall_accuracy ?? "n/a"}%.`;
    }

    const prompt = `You are an AMC exam preparation expert. Generate a personalized, actionable 7-day study plan.

AUTHORITATIVE PERFORMANCE INTELLIGENCE:
- Readiness: ${dnaRes.data?.readiness_score ?? 0}%
- Clinical accuracy: ${dnaRes.data?.clinical_accuracy ?? 0}%
- Answer stability: ${dnaRes.data?.answer_stability ?? 0}%
- Average response time: ${dnaRes.data?.time_management ?? "n/a"} seconds
- Confidence calibration: ${dnaRes.data?.confidence_calibration ?? "n/a"}%
- Distance from ideal: ${dnaRes.data?.distance_from_ideal ?? "n/a"}
- Attempts represented: ${dnaRes.data?.attempt_count ?? attempts.length}
- Behaviour archetype: ${behaviourRes.data?.archetype ?? "unclassified"}
- Rush index: ${behaviourRes.data?.rush_index ?? 0}
- Hesitation index: ${behaviourRes.data?.hesitation_index ?? 0}
- Fatigue index: ${behaviourRes.data?.fatigue_index ?? 0}
- Recent confidence attempts: ${confidenceSummary.attempts}
- Average recent confidence (1-5): ${confidenceSummary.average ?? "n/a"}
- High-confidence wrong answers: ${confidenceSummary.highConfidenceWrong}
- Low-confidence correct answers: ${confidenceSummary.lowConfidenceCorrect}

CANDIDATE CONTEXT:
- Days until exam: ${daysUntilExam ?? "Not set"}
- Exam date: ${examDate ?? "Not set"}
- Weak areas from profile: ${(weakAreas as string[]).join(", ") || "None identified"}
- Category performance: ${JSON.stringify(categoryStats)}
- Last practiced by category: ${JSON.stringify(lastPracticedMap)}
- Categories never practiced: ${neverPracticed.join(", ") || "None"}
${populationInsight}

RULES:
1. Use the intelligence above as the source of truth. Do not invent metrics.
2. Prioritize weaknesses and recent deterioration, then reinforce unstable or poorly calibrated decision-making where supported.
3. Use spaced repetition and include a spaced_repetition_note for each focus area.
4. Keep the plan practical for a 7-day cycle.
5. Do not claim that the plan guarantees exam success.
6. Return only the requested structured plan.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert AMC exam tutor. Return structured study plans using the provided tool." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_study_plan",
            description: "Create a structured 7-day study plan",
            parameters: {
              type: "object",
              properties: {
                focus_areas: { type: "array", items: { type: "object", properties: { category: { type: "string" }, priority: { type: "string" }, daily_questions: { type: "number" }, accuracy: { type: "number" }, study_tip: { type: "string" }, spaced_repetition_note: { type: "string" } }, required: ["category", "priority", "daily_questions", "study_tip"] } },
                weekly_schedule: { type: "array", items: { type: "object", properties: { day: { type: "string" }, total_questions: { type: "number" }, topics: { type: "array", items: { type: "object", properties: { category: { type: "string" }, count: { type: "number" }, focus_note: { type: "string" } }, required: ["category", "count", "focus_note"] } } }, required: ["day", "total_questions", "topics"] } },
                recommendations: { type: "array", items: { type: "object", properties: { tip: { type: "string" }, reason: { type: "string" } }, required: ["tip", "reason"] } },
                motivation: { type: "string" },
              },
              required: ["focus_areas", "weekly_schedule", "recommendations", "motivation"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_study_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
      if (response.status === 402) return json({ error: "AI credits exhausted. Please add credits." }, 402);
      return json({ error: "Failed to generate study plan" }, 500);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "AI did not return structured plan" }, 500);

    const generatedPlan = JSON.parse(toolCall.function.arguments);
    const focusAreaNames = generatedPlan.focus_areas?.map((f: any) => f.category) || [];

    const savedGeneratedAt = new Date().toISOString();
    const { error: saveError } = await supabase
      .from("study_plans")
      .upsert(
        { user_id: userId, tasks: generatedPlan, focus_areas: focusAreaNames, generated_at: savedGeneratedAt },
        { onConflict: "user_id" }
      );
    if (saveError) throw saveError;

    return json({ ...generatedPlan, generated_at: savedGeneratedAt });
  } catch (error) {
    console.error("generate-study-plan error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
