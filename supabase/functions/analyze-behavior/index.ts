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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch MCQ attempts, OSCE station attempts, and psychograph history in parallel
    const [attRes, stationRes, psychRes] = await Promise.all([
      supabase
        .from("user_attempts")
        .select("*, questions(category, difficulty, difficulty_tier)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1000),
      supabase
        .from("station_attempts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase
        .from("psychograph_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (attRes.error) throw attRes.error;
    const attempts = attRes.data || [];
    const stationAttempts = stationRes.data || [];
    const psychographs = psychRes.data || [];

    if (attempts.length === 0 && stationAttempts.length === 0) {
      return new Response(JSON.stringify({ error: "No attempts found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── MCQ Metrics ──
    const totalAttempts = attempts.length;
    const avgTime = totalAttempts > 0 ? attempts.reduce((s, a) => s + (a.time_taken_seconds || 0), 0) / totalAttempts : 0;
    const totalChanges = attempts.reduce((s, a) => s + (a.answer_changes_count || 0), 0);
    const changeRate = totalAttempts > 0 ? totalChanges / totalAttempts : 0;
    const correctRate = totalAttempts > 0 ? attempts.filter(a => a.is_correct).length / totalAttempts : 0;
    const avgPauses = totalAttempts > 0 ? attempts.reduce((s, a) => s + (a.pause_events || 0), 0) / totalAttempts : 0;
    const avgFirstClick = totalAttempts > 0 ? attempts.reduce((s, a) => s + (a.time_to_first_click || 0), 0) / totalAttempts : 0;

    // Per-subject MCQ stats
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

    // Block segmented performance
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

    // Fatigue detection
    const halfPoint = Math.floor(totalAttempts / 2);
    const firstHalfAvgTime = halfPoint > 0 ? attempts.slice(0, halfPoint).reduce((s, a) => s + (a.time_taken_seconds || 0), 0) / halfPoint : 0;
    const secondHalfAvgTime = halfPoint > 0 ? attempts.slice(halfPoint).reduce((s, a) => s + (a.time_taken_seconds || 0), 0) / (totalAttempts - halfPoint) : 0;
    const fatigueIncrease = firstHalfAvgTime > 0 ? secondHalfAvgTime / firstHalfAvgTime : 1;

    // ── OSCE Metrics ──
    const osceCount = stationAttempts.length;
    let osceAvgScore = 0;
    let osceAvgTime = 0;
    const osceSubjectMap: Record<string, { totalScore: number; count: number; avgTime: number; times: number[] }> = {};
    const osceBehavioralSignals: any[] = [];

    stationAttempts.forEach(sa => {
      const scores = sa.scores as any;
      const totalScore = typeof scores?.total === "number" ? scores.total : 0;
      osceAvgScore += totalScore;
      osceAvgTime += sa.time_taken_seconds || 0;

      const subj = sa.subject || "Unknown";
      if (!osceSubjectMap[subj]) osceSubjectMap[subj] = { totalScore: 0, count: 0, avgTime: 0, times: [] };
      osceSubjectMap[subj].totalScore += totalScore;
      osceSubjectMap[subj].count++;
      osceSubjectMap[subj].times.push(sa.time_taken_seconds || 0);

      if (sa.behavioral_signals && Object.keys(sa.behavioral_signals as any).length > 0) {
        osceBehavioralSignals.push(sa.behavioral_signals);
      }
    });

    if (osceCount > 0) {
      osceAvgScore = Math.round(osceAvgScore / osceCount);
      osceAvgTime = Math.round(osceAvgTime / osceCount);
    }
    Object.values(osceSubjectMap).forEach(s => {
      s.avgTime = s.times.reduce((a, b) => a + b, 0) / s.times.length;
    });

    // ── Trust Your Gut Metrics (from change_sequence in user_attempts) ──
    const attemptsWithChanges = attempts.filter(a => a.answer_changes_count > 0 && Array.isArray(a.change_sequence) && (a.change_sequence as any[]).length > 0);
    let firstInstinctCorrect = 0;
    let correctToWrong = 0;
    attemptsWithChanges.forEach(a => {
      const seq = a.change_sequence as any[];
      const firstAnswer = seq[0];
      const correctAnswer = (a.questions as any)?.correct_answer;
      if (firstAnswer === correctAnswer) {
        firstInstinctCorrect++;
        if (a.selected_answer !== correctAnswer) correctToWrong++;
      }
    });
    const firstInstinctAccuracy = attemptsWithChanges.length > 0 ? Math.round((firstInstinctCorrect / attemptsWithChanges.length) * 100) : null;
    const pointsLostFromChanges = correctToWrong;

    // ── Psychograph summary ──
    let psychographSummary: any = null;
    if (psychographs.length > 0) {
      const latest = psychographs[0];
      psychographSummary = {
        archetype: latest.archetype,
        cognitive_stability: latest.cognitive_stability,
        emotional_reactivity: latest.emotional_reactivity,
        silence_tolerance: latest.silence_tolerance,
        delegation_confidence: latest.delegation_confidence,
        structure_integrity: latest.structure_integrity,
        time_compression_vulnerability: latest.time_compression_vulnerability,
      };
    }

    // Build unified signals
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
      // OSCE
      osceStationsCompleted: osceCount,
      osceAvgScore,
      osceAvgTime,
      osceSubjectStats: Object.entries(osceSubjectMap).map(([subj, s]) => ({
        subject: subj,
        avgScore: Math.round(s.totalScore / s.count),
        count: s.count,
        avgTime: Math.round(s.avgTime),
      })),
      osceBehavioralSignalsSample: osceBehavioralSignals.slice(0, 5),
      // Trust Your Gut
      firstInstinctAccuracy,
      pointsLostFromChanges,
      totalAttemptsWithChanges: attemptsWithChanges.length,
      // Psychograph
      psychographSummary,
    };

    // Fetch AI training context for population comparison
    let populationPrompt = "";
    const { data: trainingCtx } = await supabase.from("ai_training_context").select("aggregate_data, candidate_count").limit(1).maybeSingle();
    if (trainingCtx?.aggregate_data) {
      const d = trainingCtx.aggregate_data as any;
      populationPrompt = `\n\nPOPULATION BENCHMARKS (${trainingCtx.candidate_count} candidates):
- Population accuracy: ${d.mcq?.overall_accuracy}%, avg time: ${d.mcq?.avg_time_seconds}s
- Archetype distribution: ${Object.entries(d.behavior?.archetype_distribution || {}).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Top traps: ${d.behavior?.common_traps?.slice(0, 5).map((t: any) => `${t.trap} (${t.percent}%)`).join(", ")}
- OSCE avg score: ${d.osce?.avg_score}%
Compare this candidate against these benchmarks.`;
    }

    // AI classification
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
            content: `You are an AMC exam behavior analyst. Analyze candidate behavioral data from MCQ practice, OSCE clinical stations, and Trust Your Gut first-instinct data to produce a UNIFIED behavior profile.${populationPrompt}

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

OSCE-specific signals to consider:
- Communication quality from station behavioral signals
- Clinical reasoning from station scores
- Time management in clinical stations
- Psychograph dimensions (if available): cognitive stability, emotional reactivity, silence tolerance, delegation confidence

Trust Your Gut signals:
- First-instinct accuracy rate
- Points lost from correct-to-wrong changes
- Whether the candidate should trust their gut more

Predict AMC score range (out of 300, pass is ~230):
- Use correctRate, OSCE performance, behavioral patterns, and subject coverage to estimate`,
          },
          {
            role: "user",
            content: `Analyze this candidate's unified behavioral data (MCQ + OSCE + Trust Your Gut):\n${JSON.stringify(signals, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_behavior",
              description: "Classify the candidate's behavioral archetype and generate predictions from unified MCQ + OSCE + TYG data",
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
