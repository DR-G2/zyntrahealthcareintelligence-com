import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchCallerPieHistory } from "../_shared/pie-v2.ts";
import { toAnalyzeAttempts } from "../_shared/pie-v2-history.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-pie-v2-authorization",
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

    // Paid feature: require active payment, valid manual override, or admin role.
    const nowIso = new Date().toISOString();
    const [{ data: paid }, { data: override }, { data: admin }] = await Promise.all([
      supabase.from("payments").select("id").eq("user_id", user.id).eq("status", "active").limit(1),
      supabase.from("manual_overrides").select("id").eq("user_id", user.id).or(`expires_at.is.null,expires_at.gt.${nowIso}`).limit(1),
      supabase.from("admin_roles").select("id").ilike("email", user.email ?? "__none__").limit(1),
    ]);
    if (!paid?.length && !override?.length && !admin?.length) {
      return new Response(JSON.stringify({ error: "subscription_required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Only explicitly mode-labelled Normal MCQ attempts may enter this analysis.
    const pie = await fetchCallerPieHistory(req, user.email, 1000);
    if ("error" in pie) {
      return new Response(JSON.stringify({ error: pie.error }), { status: pie.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const attempts = toAnalyzeAttempts(pie.rows).filter((a) => a.session_mode === "normal" || a.session_mode === "normal_mcq");

    if (attempts.length === 0) {
      return new Response(JSON.stringify({ error: "No verified Normal MCQ attempts found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── MCQ Metrics ──
    const totalAttempts = attempts.length;
    const timedAttempts = attempts.filter((a) => typeof a.time_taken_seconds === "number" && Number.isFinite(a.time_taken_seconds) && a.time_taken_seconds >= 0);
    const avgTime = timedAttempts.length ? timedAttempts.reduce((s, a) => s + a.time_taken_seconds, 0) / timedAttempts.length : null;
    const totalChanges = attempts.reduce((s, a) => s + (a.answer_changes_count || 0), 0);
    const changeRate = totalAttempts > 0 ? totalChanges / totalAttempts : 0;
    const correctRate = totalAttempts > 0 ? attempts.filter(a => a.is_correct).length / totalAttempts : 0;
    
    const firstClickAttempts = attempts.filter((a) => typeof a.time_to_first_click === "number" && Number.isFinite(a.time_to_first_click) && a.time_to_first_click >= 0);
    const avgFirstClick = firstClickAttempts.length ? firstClickAttempts.reduce((s, a) => s + a.time_to_first_click, 0) / firstClickAttempts.length : null;

    // Per-subject MCQ stats
    const subjectMap: Record<string, { correct: number; total: number; changes: number; avgTime: number | null; times: number[] }> = {};
    attempts.forEach(a => {
      const cat = (a.questions as any)?.category || "Unknown";
      if (!subjectMap[cat]) subjectMap[cat] = { correct: 0, total: 0, changes: 0, avgTime: 0, times: [] };
      subjectMap[cat].total++;
      if (a.is_correct) subjectMap[cat].correct++;
      subjectMap[cat].changes += a.answer_changes_count || 0;
      if (typeof a.time_taken_seconds === "number" && Number.isFinite(a.time_taken_seconds) && a.time_taken_seconds >= 0) subjectMap[cat].times.push(a.time_taken_seconds);
    });
    Object.values(subjectMap).forEach(s => {
      s.avgTime = s.times.length ? s.times.reduce((a, b) => a + b, 0) / s.times.length : null;
    });

    // Block segmented performance
    const sessions: Record<string, typeof attempts> = {};
    attempts.forEach(a => {
      if (!sessions[a.session_id]) sessions[a.session_id] = [];
      sessions[a.session_id].push(a);
    });

    const blockPerf: Record<string, { accuracy: number; avgTime: number | null; changeRate: number }> = {};
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
            avgTime: (() => { const validTimes = slice.map((a) => a.time_taken_seconds).filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0); return validTimes.length ? Math.round(validTimes.reduce((sum, v) => sum + v, 0) / validTimes.length) : null; })(),
            changeRate: Math.round((slice.reduce((s, a) => s + (a.answer_changes_count || 0), 0) / slice.length) * 100),
          };
        }
      });
    }

    // Fatigue detection
    const halfPoint = Math.floor(timedAttempts.length / 2);
    const firstHalfTimes = timedAttempts.slice(0, halfPoint).map((a) => a.time_taken_seconds as number);
    const secondHalfTimes = timedAttempts.slice(halfPoint).map((a) => a.time_taken_seconds as number);
    const firstHalfAvgTime = firstHalfTimes.length ? firstHalfTimes.reduce((sum, value) => sum + value, 0) / firstHalfTimes.length : null;
    const secondHalfAvgTime = secondHalfTimes.length ? secondHalfTimes.reduce((sum, value) => sum + value, 0) / secondHalfTimes.length : null;
    const fatigueIncrease = firstHalfAvgTime !== null && firstHalfAvgTime > 0 && secondHalfAvgTime !== null ? secondHalfAvgTime / firstHalfAvgTime : null;

    // Build unified signals
    const signals = {
      totalAttempts,
      avgTime: avgTime === null ? null : Math.round(avgTime),
      changeRate: Math.round(changeRate * 100) / 100,
      correctRate: Math.round(correctRate * 100) / 100,
      
      avgFirstClick: avgFirstClick === null ? null : Math.round(avgFirstClick),
      fatigueIncrease: fatigueIncrease === null ? null : Math.round(fatigueIncrease * 100) / 100,
      subjectStats: Object.entries(subjectMap).map(([cat, s]) => ({
        category: cat,
        accuracy: Math.round((s.correct / s.total) * 100),
        changeRate: Math.round((s.changes / s.total) * 100),
        avgTime: s.avgTime === null ? null : Math.round(s.avgTime),
        total: s.total,
      })),
      blockPerformance: blockPerf,
      // OSCE
      // Trust Your Gut
    };

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
            content: `You are an MCQ practice behaviour analyst. Describe patterns supported by explicitly labelled Normal MCQ attempts only. Do not combine OSCE, Nudge, AMC Exam mode, or Trust Your Gut aggregates. If a metric is null or unavailable, do not infer or replace it. Do not predict exam scores, pass likelihood, or clinical readiness.\n\nArchetypes:
- panic_changer: only when recorded change frequency and timing support repeated changing; first-instinct correctness is not supplied
- rusher: only when observed response time is low and recorded accuracy supports concern; question difficulty is not supplied
- paralyzer: Time >5 min average, very slow decisions (pause data is unavailable and must not be inferred)
- strategist: only when recorded changes and available timing are consistent; elimination behaviour is not supplied, and do not label this optimal
- fatigue_victim: Time per question increases 40%+ in later questions, more changes later
- subject_avoider: only describe subject-specific accuracy or timing differences present in subjectStats; stress markers are not supplied

AMC Traps to detect:
- most_appropriate_paralysis: Long time, multiple changes on "most appropriate" questions
- second_guessing_success: Changed from correct to wrong repeatedly
- rushing_at_end: Last questions much faster with lower accuracy
- distractor_fixation: Spending time on wrong options
- stem_overload: do not classify from pauses or re-reads because those observations are not supplied

Do not infer personality, motivation, clinical competence, causation, exam score, pass likelihood, or clinical readiness from these behavioural signals.`,
          },
          {
            role: "user",
            content: `Analyze this candidate's Normal MCQ behavioural evidence:\n${JSON.stringify(signals, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_behavior",
              description: "Summarize observed Normal MCQ behaviour only; do not generate exam-score or pass predictions.",
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
                required: ["archetype", "trap_flags", "recommendations", "critical_finding"],
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
      if (!toolCall?.function?.arguments) throw new Error("Missing classification arguments");
      classification = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Behaviour classification unavailable; no unsupported pattern was substituted." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          avgTime: s.avgTime === null ? null : Math.round(s.avgTime),
          total: s.total,
          type: (s.changes / s.total) > 0.5 ? "behavioral" : (s.correct / s.total) < 0.5 ? "knowledge" : "stable",
        }])
      ),
      trap_flags: classification.trap_flags,
      // Historical score prediction fields are deliberately cleared; no validated score model exists.
      predicted_score_low: null,
      predicted_score_high: null,
      predicted_score_potential: null,
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
