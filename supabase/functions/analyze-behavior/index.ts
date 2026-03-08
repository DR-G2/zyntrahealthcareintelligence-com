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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Get user from auth
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all attempts for this user with question data
    const { data: attempts, error: attError } = await supabase
      .from("user_attempts")
      .select("*, questions(category, difficulty, difficulty_tier)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (attError) throw attError;
    if (!attempts || attempts.length === 0) {
      return new Response(JSON.stringify({ error: "No attempts found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Compute aggregate metrics
    const totalAttempts = attempts.length;
    const avgTime = attempts.reduce((s, a) => s + (a.time_taken_seconds || 0), 0) / totalAttempts;
    const totalChanges = attempts.reduce((s, a) => s + (a.answer_changes_count || 0), 0);
    const changeRate = totalChanges / totalAttempts;
    const correctRate = attempts.filter(a => a.is_correct).length / totalAttempts;
    const avgPauses = attempts.reduce((s, a) => s + (a.pause_events || 0), 0) / totalAttempts;
    const avgFirstClick = attempts.reduce((s, a) => s + (a.time_to_first_click || 0), 0) / totalAttempts;

    // Per-subject stats
    const subjectMap: Record<string, { correct: number; total: number; changes: number; avgTime: number; times: number[] }> = {};
    attempts.forEach(a => {
      const cat = (a.questions as any)?.category || "Unknown";
      if (!subjectMap[cat]) subjectMap[cat] = { correct: 0, total: 0, changes: 0, avgTime: 0, times: [] };
      subjectMap[cat].total++;
      if (a.is_correct) subjectMap[cat].correct++;
      subjectMap[cat].changes += a.answer_changes_count || 0;
      subjectMap[cat].times.push(a.time_taken_seconds || 0);
    });
    Object.values(subjectMap).forEach(s => {
      s.avgTime = s.times.reduce((a, b) => a + b, 0) / s.times.length;
    });

    // Block segmented performance (by session groups of 20)
    const sessions: Record<string, typeof attempts> = {};
    attempts.forEach(a => {
      if (!sessions[a.session_id]) sessions[a.session_id] = [];
      sessions[a.session_id].push(a);
    });

    const blockPerf: Record<string, { accuracy: number; avgTime: number; changeRate: number }> = {};
    const latestSession = Object.values(sessions).sort((a, b) => 
      new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime()
    )[0];

    if (latestSession) {
      const segments = [
        { key: "Q1-20", start: 0, end: 20 },
        { key: "Q21-40", start: 20, end: 40 },
        { key: "Q41-60", start: 40, end: 60 },
      ];
      segments.forEach(seg => {
        const slice = latestSession.slice(seg.start, seg.end);
        if (slice.length > 0) {
          blockPerf[seg.key] = {
            accuracy: Math.round((slice.filter(a => a.is_correct).length / slice.length) * 100),
            avgTime: Math.round(slice.reduce((s, a) => s + (a.time_taken_seconds || 0), 0) / slice.length),
            changeRate: Math.round((slice.reduce((s, a) => s + (a.answer_changes_count || 0), 0) / slice.length) * 100),
          };
        }
      });
    }

    // Fatigue detection: compare first half vs second half timing
    const halfPoint = Math.floor(totalAttempts / 2);
    const firstHalfAvgTime = attempts.slice(0, halfPoint).reduce((s, a) => s + (a.time_taken_seconds || 0), 0) / halfPoint;
    const secondHalfAvgTime = attempts.slice(halfPoint).reduce((s, a) => s + (a.time_taken_seconds || 0), 0) / (totalAttempts - halfPoint);
    const fatigueIncrease = secondHalfAvgTime / firstHalfAvgTime;

    // Build signals object for AI classification
    const signals = {
      totalAttempts,
      avgTime: Math.round(avgTime),
      changeRate: Math.round(changeRate * 100) / 100,
      correctRate: Math.round(correctRate * 100) / 100,
      avgPauses: Math.round(avgPauses * 100) / 100,
      avgFirstClick: Math.round(avgFirstClick),
      fatigueIncrease: Math.round(fatigueIncrease * 100) / 100,
      subjectStats: Object.entries(subjectMap).map(([cat, s]) => ({
        category: cat,
        accuracy: Math.round((s.correct / s.total) * 100),
        changeRate: Math.round((s.changes / s.total) * 100),
        avgTime: Math.round(s.avgTime),
        total: s.total,
      })),
      blockPerformance: blockPerf,
    };

    // Use AI to classify archetype and detect traps
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an AMC exam behavior analyst. Analyze candidate behavioral data and classify them.

Archetypes:
- panic_changer: 3+ avg changes, final answer different from first instinct, time >3 min avg
- rusher: Time <45 seconds avg, no changes, often incorrect on hard questions
- paralyzer: Time >5 min avg, multiple pauses, very slow decisions
- strategist: Systematic elimination, 1-2 deliberate changes, consistent timing (optimal)
- fatigue_victim: Time per question increases 40%+ in later questions, more changes later
- subject_avoider: Fast incorrect on specific topics, visible stress markers in certain subjects

AMC Traps to detect:
- most_appropriate_paralysis: Long time, multiple changes on "most appropriate" questions
- second_guessing_success: Changed from correct to wrong repeatedly
- rushing_at_end: Last questions much faster with lower accuracy
- distractor_fixation: Spending time on wrong options
- stem_overload: Multiple pauses, re-reads on complex stems

Predict AMC score range (out of 300, pass is ~230):
- Use correctRate, behavioral patterns, and subject coverage to estimate`,
          },
          {
            role: "user",
            content: `Analyze this candidate's behavioral data:\n${JSON.stringify(signals, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_behavior",
              description: "Classify the candidate's behavioral archetype and generate predictions",
              parameters: {
                type: "object",
                properties: {
                  archetype: {
                    type: "string",
                    enum: ["panic_changer", "rusher", "paralyzer", "strategist", "fatigue_victim", "subject_avoider"],
                  },
                  trap_flags: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        trap: { type: "string" },
                        description: { type: "string" },
                        severity: { type: "string", enum: ["low", "medium", "high"] },
                      },
                      required: ["trap", "description", "severity"],
                    },
                  },
                  predicted_score_low: { type: "integer" },
                  predicted_score_high: { type: "integer" },
                  predicted_score_potential: { type: "integer" },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        action_link: { type: "string" },
                      },
                      required: ["title", "description", "priority"],
                    },
                  },
                  critical_finding: { type: "string" },
                },
                required: ["archetype", "trap_flags", "predicted_score_low", "predicted_score_high", "predicted_score_potential", "recommendations", "critical_finding"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_behavior" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI classification failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let classification;
    try {
      classification = JSON.parse(toolCall.function.arguments);
    } catch {
      // Fallback classification based on signals
      classification = {
        archetype: changeRate > 2 ? "panic_changer" : avgTime < 45 ? "rusher" : avgTime > 300 ? "paralyzer" : fatigueIncrease > 1.4 ? "fatigue_victim" : "strategist",
        trap_flags: [],
        predicted_score_low: Math.round(correctRate * 300 * 0.8),
        predicted_score_high: Math.round(correctRate * 300 * 1.1),
        predicted_score_potential: Math.round(correctRate * 300 * 1.2),
        recommendations: [{ title: "Continue practicing", description: "Keep up your current routine", priority: "medium" }],
        critical_finding: `Your overall accuracy is ${Math.round(correctRate * 100)}%.`,
      };
    }

    // Upsert behavior_profiles
    const profileData = {
      user_id: user.id,
      archetype: classification.archetype,
      archetype_signals: signals,
      block_performance: blockPerf,
      subject_patterns: Object.fromEntries(
        Object.entries(subjectMap).map(([cat, s]) => [cat, {
          accuracy: Math.round((s.correct / s.total) * 100),
          changeRate: Math.round((s.changes / s.total) * 100),
          avgTime: Math.round(s.avgTime),
          total: s.total,
          type: (s.changes / s.total) > 0.5 ? "behavioral" : (s.correct / s.total) < 0.5 ? "knowledge" : "stable",
        }])
      ),
      trap_flags: classification.trap_flags,
      predicted_score_low: classification.predicted_score_low,
      predicted_score_high: classification.predicted_score_high,
      predicted_score_potential: classification.predicted_score_potential,
      recommendations: classification.recommendations,
      updated_at: new Date().toISOString(),
    };

    const { data: existingProfile } = await supabase
      .from("behavior_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingProfile) {
      await supabase.from("behavior_profiles").update(profileData).eq("user_id", user.id);
    } else {
      await supabase.from("behavior_profiles").insert(profileData);
    }

    return new Response(JSON.stringify({
      ...classification,
      signals,
      block_performance: blockPerf,
      subject_patterns: profileData.subject_patterns,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-behavior error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
